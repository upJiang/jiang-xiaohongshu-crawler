<template>
  <div class="xiaohongshu-container">
    <a-card title="小红书数据采集" :bordered="false">
      <a-space direction="vertical" style="width: 100%">
        <a-upload
          accept=".xlsx,.xls"
          :beforeUpload="handleUpload"
          :showUploadList="false"
        >
          <a-button>
            <upload-outlined />
            上传已有数据
          </a-button>
        </a-upload>

        <a-alert
          v-if="existingData.length"
          :message="`已加载${existingData.length}条历史数据`"
          type="info"
          show-icon
        />

        <!-- 历史数据展示区域 -->
        <a-card
          v-if="existingData.length"
          title="历史数据"
          style="margin-top: 20px"
        >
          <template #extra>
            <a-button type="primary" @click="handleSaveHistoryToExcel">
              保存到Excel
            </a-button>
          </template>
          <a-table
            :dataSource="existingData"
            :columns="columns"
            :scroll="{ x: 1500, y: 500 }"
            :pagination="{
              total: existingData.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
            }"
          />
        </a-card>

        <a-form layout="inline">
          <a-form-item label="搜索关键词">
            <a-input
              v-model:value="crawlerConfig.keyword"
              placeholder="请输入关键词"
            />
          </a-form-item>
          <a-form-item label="采集数量">
            <a-input-number
              v-model:value="crawlerConfig.allNeedNums"
              :min="1"
              :max="100"
              placeholder="请输入采集数量"
            />
          </a-form-item>
        </a-form>

        <a-space>
          <a-button type="primary" :loading="loading" @click="startCrawl">
            开始采集数据
          </a-button>
          <a-button
            type="primary"
            :loading="loading"
            @click="startInfiniteCrawl"
          >
            开始无限循环采集
          </a-button>
          <a-button danger :disabled="!loading" @click="stopCrawl">
            停止采集
          </a-button>
        </a-space>

        <a-alert
          v-if="statusMessage"
          :message="statusMessage"
          :type="statusType"
          show-icon
        />
      </a-space>
    </a-card>

    <!-- 采集结果展示区域 -->
    <a-card v-if="dataList.length" title="采集结果" style="margin-top: 20px">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="handleSaveToExcel">
            保存到Excel
          </a-button>
          <a-button type="primary" @click="handleMergeAndSave">
            合并旧数据并保存
          </a-button>
        </a-space>
      </template>
      <a-table
        :dataSource="dataList"
        :columns="columns"
        :scroll="{ x: 1500, y: 500 }"
        :pagination="{
          total: dataList.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }"
      />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { UploadOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { ref } from "vue";

import { analyzeWithAI } from "@/views/xiaohongshu/aiService";
import type { CrawlerConfig, NoteData } from "@/views/xiaohongshu/contants";
import { saveToExcel } from "@/views/xiaohongshu/excel";

const loading = ref(false);
const statusMessage = ref("");
const statusType = ref<"info" | "success" | "error" | "warning">("info");
const dataList = ref<NoteData[]>([]);
const abortController = ref<AbortController | null>(null);

const crawlerConfig = ref<CrawlerConfig>({
  keyword: "研选家",
  allNeedNums: 5,
});

const existingData = ref<NoteData[]>([]);
const existingLinks = ref<Set<string>>(new Set());

const columns = [
  { title: "笔记标题", dataIndex: "笔记标题", width: 200 },
  { title: "笔记作者", dataIndex: "笔记作者", width: 120 },
  { title: "笔记时间", dataIndex: "笔记时间", width: 120 },
  { title: "发表城市", dataIndex: "发表城市", width: 120 },
  { title: "IP属地", dataIndex: "IP属地", width: 120 },
  { title: "笔记链接", dataIndex: "笔记链接", width: 200 },
  { title: "笔记内容", dataIndex: "笔记内容", width: 300, ellipsis: true },
  { title: "图片链接", dataIndex: "图片链接", width: 200, ellipsis: true },
  { title: "评论内容", dataIndex: "评论内容", width: 200, ellipsis: true },
  { title: "AI分析", dataIndex: "ai分析", width: 200, ellipsis: true },
  { title: "AI思考过程", dataIndex: "ai思考过程", width: 300, ellipsis: true },
  { title: "关键词", dataIndex: "关键词", width: 100 },
];

const isInfiniteCrawling = ref(false);

const stopCrawl = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
    isInfiniteCrawling.value = false;
    statusType.value = "warning";
    statusMessage.value = "采集已手动停止";
    message.warning("采集已停止");
  }
};

const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_HOST}/api/uploadExcel`.replace(
        "undefined/",
        "",
      ),
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error("上传失败");
    }

    const result = await response.json();
    if (result.success) {
      existingData.value = result.data;
      existingLinks.value = new Set(result.existingLinks);
      message.success(`成功加载${result.data.length}条历史数据`);
    }
  } catch (error) {
    message.error("上传文件失败：" + (error as Error).message);
  }

  return false; // 阻止默认上传行为
};

const handleSaveToExcel = async () => {
  try {
    statusMessage.value = "正在保存数据...";
    statusType.value = "info";

    // 合并现有数据和新数据
    const allData = [...existingData.value, ...dataList.value];

    await saveToExcel(allData, "最新舆情数据.xlsx", false);

    // 修改下载链接
    window.location.href = `${
      import.meta.env.VITE_SERVER_HOST
    }/api/downloadExcel?filename=最新舆情数据.xlsx`;

    statusType.value = "success";
    statusMessage.value = "数据保存成功！";
    message.success("数据已保存到Excel");
  } catch (error) {
    console.error("保存错误:", error);
    statusType.value = "error";
    statusMessage.value = "保存失败: " + (error as Error).message;
    message.error("保存失败：" + (error as Error).message);
  }
};

const handleMergeAndSave = async () => {
  try {
    statusMessage.value = "正在合并并保存数据...";
    statusType.value = "info";

    // 合并现有数据和新数据
    const allData = [...existingData.value, ...dataList.value];

    await saveToExcel(allData, "合并舆情数据.xlsx", false);

    // 修改下载链接
    window.location.href = `${
      import.meta.env.VITE_SERVER_HOST
    }/api/downloadExcel?filename=合并舆情数据.xlsx`;

    statusType.value = "success";
    statusMessage.value = "数据合并保存成功！";
    message.success("数据已合并保存到Excel");
  } catch (error) {
    console.error("保存错误:", error);
    statusType.value = "error";
    statusMessage.value = "保存失败: " + (error as Error).message;
    message.error("保存失败：" + (error as Error).message);
  }
};

const handleSaveHistoryToExcel = async () => {
  try {
    statusMessage.value = "正在保存历史数据...";
    statusType.value = "info";

    await saveToExcel(existingData.value, "历史舆情数据.xlsx", false);

    window.location.href = `${
      import.meta.env.VITE_SERVER_HOST
    }/api/downloadExcel?filename=历史舆情数据.xlsx`;

    statusType.value = "success";
    statusMessage.value = "历史数据保存成功！";
    message.success("历史数据已保存到Excel");
  } catch (error) {
    console.error("保存错误:", error);
    statusType.value = "error";
    statusMessage.value = "保存失败: " + (error as Error).message;
    message.error("保存失败：" + (error as Error).message);
  }
};

const startCrawl = async (infinite = false) => {
  if (!crawlerConfig.value.keyword) {
    message.error("请输入搜索关键词");
    return;
  }

  try {
    loading.value = true;
    statusMessage.value = "正在采集数据...";
    statusType.value = "info";

    abortController.value = new AbortController();

    const config = {
      ...crawlerConfig.value,
      existingLinks: Array.from(existingLinks.value),
    };

    // 使用完整的URL地址
    const apiUrl = `${import.meta.env.VITE_SERVER_HOST}/api/crawl`.replace(
      "undefined/",
      "",
    );
    console.log("请求URL:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
      signal: abortController.value.signal,
    });

    if (!response.ok) {
      throw new Error("采集请求失败");
    }

    const result = await response.json();
    console.log("当前数据", result);

    if (!result.success) {
      throw new Error(result.error);
    }

    // 更新当前采集结果显示
    dataList.value = result.data;

    // AI分析
    statusMessage.value = "正在进行AI分析...";
    const aiResults = await analyzeWithAI(dataList.value);

    dataList.value.forEach((data, index) => {
      data.ai分析 = aiResults[index].result;
      data.ai思考过程 = aiResults[index].reasoning;
    });

    // 自动保存数据（即使后续步骤出错也会保存）
    try {
      statusMessage.value = "正在保存数据...";
      await saveToExcel(dataList.value, "最新舆情数据.xlsx", true);
    } catch (saveError) {
      console.error("自动保存失败:", saveError);
      message.warning("自动保存失败，请使用手动保存按钮");
    }

    // 修改这部分逻辑，只在完成当前批次采集后更新历史数据
    if (infinite) {
      // 更新历史数据和链接集合
      existingData.value = [...existingData.value, ...dataList.value];
      existingLinks.value = new Set([
        ...Array.from(existingLinks.value),
        ...dataList.value.map((item) => item.笔记链接),
      ]);
      // 清空当前数据列表，准备下一轮采集
      dataList.value = [];
    }

    loading.value = false;
    statusType.value = "success";
    statusMessage.value = "数据采集完成！";
    message.success("采集成功！");

    if (infinite && isInfiniteCrawling.value) {
      // 延迟1秒后继续下一轮采集
      setTimeout(() => {
        startCrawl(true);
      }, 1000);
    }
  } catch (error) {
    console.error("采集错误:", error);
    loading.value = false;
    statusType.value = "error";

    if ((error as Error).name === "AbortError") {
      isInfiniteCrawling.value = false;
      return;
    }

    statusMessage.value = "采集失败: " + (error as Error).message;
    message.error("采集失败：" + (error as Error).message);

    // 如果是无限循环模式，等待后重试
    if (infinite && isInfiniteCrawling.value) {
      setTimeout(() => {
        startCrawl(true);
      }, 5000); // 出错后等待5秒再重试
    }
  } finally {
    if (!infinite) {
      abortController.value = null;
    }
  }
};

const startInfiniteCrawl = async () => {
  isInfiniteCrawling.value = true;
  await startCrawl(true);
};
</script>

<style scoped>
.xiaohongshu-container {
  padding: 24px;
}
</style>

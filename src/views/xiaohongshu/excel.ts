import path from "path";
import * as XLSX from "xlsx";

import type { NoteData } from "@/views/xiaohongshu/contants";

export const columnWidths = {
  笔记标题: 30,
  笔记作者: 15,
  笔记时间: 15,
  发表城市: 15,
  IP属地: 15,
  笔记链接: 50,
  笔记内容: 100,
  图片链接: 50,
  评论内容: 50,
  ai分析: 50,
  ai思考过程: 120,
  关键词: 20,
};

export async function saveToExcel(
  data: NoteData[],
  filename: string,
  append: boolean = false,
) {
  try {
    let existingData: NoteData[] = [];

    // 如果是追加模式，先尝试读取现有文件
    if (append) {
      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_SERVER_HOST
          }/api/readExcel?filename=${filename}`, // 开发环境
        );
        if (response.ok) {
          existingData = await response.json();
        }
      } catch (error) {
        console.warn("无法读取现有文件，将创建新文件");
      }
    }

    // 合并现有数据和新数据
    const allData = [...existingData, ...data];

    // 发送到服务器保存
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_HOST}/api/saveExcel`, // 开发环境
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: allData,
          filename: filename,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("保存文件失败");
    }
  } catch (error) {
    console.error("保存到Excel错误:", error);
    throw error;
  }
}

export function getExistingLinks(): string[] {
  try {
    const filePath = path.join(
      __dirname,
      "小红书爬虫文件",
      "最新舆情数据.xlsx",
    );
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return (data as NoteData[]).map((row) => row["笔记链接"]);
  } catch (error) {
    console.log("读取已有Excel文件失败，可能是首次运行:", error);
    return [];
  }
}

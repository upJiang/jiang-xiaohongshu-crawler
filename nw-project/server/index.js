const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require("multer");

const app = express();

// 更新 CORS 配置
app.use(
  cors({
    origin: ["http://localhost:7777"], // 只允许开发服务器的请求
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

// 添加全局浏览器实例和用户数据目录配置
let browser = null;
const userDataDir = path.join(__dirname, "chrome-data");

// 修改确保浏览器实例存在的函数
async function ensureBrowser() {
  if (!browser) {
    console.log("创建新的浏览器实例...");
    // 确保 chrome-data 目录存在
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        "--no-sandbox",
        "--start-maximized",
        "--disable-features=site-per-process",
      ],
      // 移除 userDataDir 配置，使用系统默认浏览器
      ignoreDefaultArgs: ["--enable-automation"],
    });

    // 添加错误处理
    browser.on("disconnected", async () => {
      console.log("浏览器意外关闭，正在重新启动...");
      browser = null;
      await ensureBrowser();
    });
  }
  return browser;
}

// 读取关键词列表
const getKeywords = async () => {
  try {
    const filePath = path.join(__dirname, "keywords.txt");
    const content = await fs.promises.readFile(filePath, "utf-8");
    return content.split("\n").filter((keyword) => keyword.trim());
  } catch (error) {
    console.error("读取关键词文件失败:", error);
    return [];
  }
};

// 延迟函数
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 提取页面数据
const extractPageData = async (page) => {
  // 先获取基本数据
  const basicData = await page.evaluate(() => {
    const getTextContent = (selector) => {
      const element = document.querySelector(selector);
      return element ? element.textContent.trim() : "";
    };

    // 添加数据清理函数
    const cleanText = (text) => {
      if (!text) return "";
      return text
        .replace(/\s+/g, " ") // 将多个空白字符替换为单个空格
        .trim();
    };

    const content = document.querySelector(".note-text");
    const noteContent = content ? cleanText(content.textContent) : "";

    const imgContainer = document.querySelector(".img-container img");
    const imgLink = imgContainer ? imgContainer.src : "";

    const commentSection = document.querySelector("点击评论");
    let commentContent = "";
    if (commentSection) {
      commentContent = "没有评论内容";
    } else {
      const noteText = document.querySelector(".comments-el");
      commentContent = noteText ? cleanText(noteText.textContent) : "";
    }

    // 如果笔记时间里面有城市信息，则增加发表城市的属性，如果没有发表城市属性为未知
    const noteTime = cleanText(getTextContent(".date"));
    const city =
      noteTime.split(" ")?.length > 2 ? noteTime.split(" ")[2] : "未知";

    return {
      笔记标题: cleanText(getTextContent(".title")),
      笔记作者: cleanText(getTextContent(".username")),
      笔记时间: cleanText(getTextContent(".date")),
      发表城市: city,
      笔记链接: window.location.href,
      笔记内容: noteContent,
      图片链接: imgLink,
      评论内容: commentContent,
    };
  });

  // 获取作者主页链接
  const authorLink = await page.evaluate(() => {
    const authorWrapper = document.querySelector(".author-wrapper");
    if (!authorWrapper) return null;
    const info = authorWrapper.querySelector(".info a");
    return info ? info.getAttribute("href") : null;
  });

  // 如果找到作者链接，访问作者主页获取 IP 属地
  if (authorLink) {
    try {
      await page.goto(`https://www.xiaohongshu.com${authorLink}`, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      await delay(3000);

      const ipLocation = await page.evaluate(() => {
        const ipElement = document.querySelector(".user-IP");
        return ipElement ? ipElement.textContent.split("：")[1] : "未知";
      });

      basicData.IP属地 = ipLocation;

      // 返回到原始笔记页面
      await page.goBack();
      await delay(2000);
    } catch (error) {
      console.error("获取IP属地失败:", error);
      basicData.IP属地 = "获取失败";
    }
  } else {
    basicData.IP属地 = "未知";
  }

  return basicData;
};

app.post("/api/crawl", async (req, res) => {
  try {
    const { keyword, allNeedNums, existingLinks = [] } = req.body;

    const currentBrowser = await ensureBrowser();
    const pages = await currentBrowser.pages();
    const page = pages.length > 0 ? pages[0] : await currentBrowser.newPage();
    const keywordsArray = await getKeywords();

    await page.goto(
      `https://www.xiaohongshu.com/search_result?keyword=${keyword}&source=web_search_result_notes&type=51`,
    );

    const uniqueHrefs = [];
    const dataList = [];

    // 收集链接
    while (uniqueHrefs.length < allNeedNums) {
      const divList = await page.$$(".cover.ld.mask");
      for (const element of divList) {
        const href = await element.evaluate((el) => el.getAttribute("href"));
        if (href) {
          const fullHref =
            "https://www.xiaohongshu.com/explore/" + href.split("/")[2];
          if (
            !uniqueHrefs.includes(fullHref) &&
            !existingLinks.includes(fullHref)
          ) {
            uniqueHrefs.push(fullHref);
          }
        }
      }

      if (uniqueHrefs.length >= allNeedNums) break;

      await page.evaluate(() => window.scrollBy(0, 800));
      const endElement = await page.$("text/ - THE END -");
      if (endElement) break;

      await delay(1000);
    }

    // 采集数据
    for (const link of uniqueHrefs) {
      if (dataList.length >= allNeedNums) break;

      try {
        await page.goto(link, { waitUntil: "networkidle0", timeout: 30000 });
        await delay(3000);

        const data = await extractPageData(page);

        // 匹配关键词
        for (const keyword of keywordsArray) {
          if (data.笔记标题.includes(keyword)) {
            data.关键词 = keyword;
            break;
          }
        }
        if (!data.关键词) {
          data.关键词 = "没有找到关键词";
        }

        dataList.push(data);
      } catch (error) {
        console.error(`处理链接 ${link} 时出错:`, error);
        continue;
      }
    }

    // 不关闭页面，只清空页面内容
    // await page.goto("about:blank");
    res.json({ success: true, data: dataList });
  } catch (error) {
    console.error("采集错误:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 确保存储目录存在
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 读取Excel文件
app.get("/api/readExcel", (req, res) => {
  try {
    const filename = req.query.filename;
    const filePath = path.join(dataDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.json([]);
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    res.json(data);
  } catch (error) {
    console.error("读取Excel文件失败:", error);
    res.status(500).json({ error: "读取Excel文件失败" });
  }
});

// 保存Excel文件
app.post("/api/saveExcel", (req, res) => {
  try {
    const { data, filename } = req.body;
    const filePath = path.join(dataDir, filename);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: [
        "笔记标题",
        "笔记作者",
        "笔记时间",
        "发表城市",
        "IP属地",
        "笔记链接",
        "笔记内容",
        "图片链接",
        "评论内容",
        "ai分析",
        "ai思考过程",
        "关键词",
      ],
    });

    // 设置列宽
    const columnWidths = {
      笔记标题: { wch: 30 },
      笔记作者: { wch: 15 },
      笔记时间: { wch: 15 },
      发表城市: { wch: 15 },
      IP属地: { wch: 15 },
      笔记链接: { wch: 50 },
      笔记内容: { wch: 100 },
      图片链接: { wch: 50 },
      评论内容: { wch: 50 },
      ai分析: { wch: 50 },
      ai思考过程: { wch: 120 },
      关键词: { wch: 20 },
    };
    worksheet["!cols"] = Object.values(columnWidths);

    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // 保存文件
    XLSX.writeFile(workbook, filePath);

    res.json({ success: true });
  } catch (error) {
    console.error("保存Excel文件失败:", error);
    res.status(500).json({ error: "保存Excel文件失败" });
  }
});

// 上传Excel文件
const upload = multer({ dest: path.join(__dirname, "..", "data", "uploads") });

app.post("/api/uploadExcel", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有上传文件" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // 获取所有笔记链接
    const existingLinks = data.map((row) => row["笔记链接"]).filter(Boolean);

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      existingLinks,
      data,
    });
  } catch (error) {
    console.error("处理上传文件失败:", error);
    res.status(500).json({ error: "处理上传文件失败" });
  }
});

// 修改下载接口
app.get("/api/downloadExcel", (req, res) => {
  try {
    const filename = req.query.filename;
    const filePath = path.join(dataDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    res.download(filePath);
  } catch (error) {
    console.error("下载文件失败:", error);
    res.status(500).json({ error: "下载文件失败" });
  }
});

// 进程退出处理
process.on("SIGINT", async () => {
  console.log("正在关闭服务器...");
  if (browser) {
    await browser.close();
  }
  process.exit();
});

process.on("SIGTERM", async () => {
  console.log("收到 SIGTERM 信号，正在关闭服务器...");
  if (browser) {
    await browser.close();
  }
  process.exit();
});

const PORT = 4000;

// 设置静态文件目录
app.use(express.static(path.join(__dirname, "public")));

// 所有的路由都返回 index.html，支持前端路由
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dist/index.html"));
});

// 如果没有被其他代码调用，则启动服务器
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
  });
}

module.exports = app;

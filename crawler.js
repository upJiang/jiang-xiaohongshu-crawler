const puppeteer = require("puppeteer");
const XLSX = require("xlsx");
const path = require("path");
const OpenAI = require("openai");

const allNeedNums = 2;

// 在文件开头附近添加用户数据目录的配置
const userDataDir = path.join(__dirname, "chrome-data");

async function saveToExcel(data, filename) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  const columnWidths = {
    笔记标题: 30,
    笔记作者: 15,
    笔记时间: 15,
    笔记链接: 50,
    笔记内容: 100,
    图片链接: 50,
    评论内容: 50,
    ai分析: 50,
    ai思考过程: 120,
    关键词: 20,
  };

  // 设置每列的宽度
  worksheet["!cols"] = Object.values(columnWidths).map((width) => ({
    wch: width,
  }));

  // 获取所有列的字母表示
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const columns = Object.keys(data[0]);

  // 设置样式
  for (let C = range.s.c; C <= range.e.c; C++) {
    const columnLetter = XLSX.utils.encode_col(C);

    // 设置表头样式
    const headerCell = columnLetter + "1";
    if (!worksheet[headerCell].s) worksheet[headerCell].s = {};
    worksheet[headerCell].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4472C4" } },
      alignment: { horizontal: "center", vertical: "center" },
    };

    // 为每个数据单元格设置样式
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      const cellRef = columnLetter + (R + 1);
      if (!worksheet[cellRef].s) worksheet[cellRef].s = {};

      // 关键词列特殊样式
      if (columns[C] === "关键词") {
        worksheet[cellRef].s = {
          font: { color: { rgb: "FF0000" }, bold: true },
          fill: { fgColor: { rgb: "FFEB9C" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      } else {
        // 其他列的基本样式
        worksheet[cellRef].s = {
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
        };
      }
    }
  }

  // 添加工作表到工作簿中（这行是关键！）
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  XLSX.writeFile(workbook, path.join(__dirname, "小红书爬虫文件", filename));
}

// 首先添加一个通用的延时函数
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 修改AI分析函数为批量处理
async function analyzeWithAI(dataList) {
  const openai = new OpenAI({
    apiKey: "sk-lR3ZOOsvkqIaCowu1hprpJFxjOsmgIUwswqPJEN6dPTzhVLw",
    baseURL: "https://api.lkeap.cloud.tencent.com/v1",
  });

  try {
    // 构建批量分析的提示词
    const contentToAnalyze = dataList
      .map(
        (data, index) =>
          `内容${index + 1}:
            标题：${data.笔记标题}
            内容：${data.笔记内容}`,
      )
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "deepseek-r1",
      messages: [
        {
          role: "system",
          content: `你是一位专业的舆情分析师。请分析每条内容并按以下格式返回结果：

                            内容1:
                            情感倾向：[正面/负面]
                            分析理由：[详细说明分析过程]

                            内容2:
                            情感倾向：[正面/负面]
                            分析理由：[详细说明分析过程]

                            依此类推...

                            分析规则：
                            1. 关注内容中的情感词汇、评价性词语
                            2. 考虑用户的表达方式和语气
                            3. 分析内容对品牌形象的潜在影响
                            4. 情感倾向只能是"正面"或"负面"
                            5. 如果内容中性或无法判断，返回"正面"`,
        },
        {
          role: "user",
          content: contentToAnalyze,
        },
      ],
    });

    const analysisText = completion.choices[0].message.content;

    // 将返回的文本按内容分块
    const contentBlocks = analysisText
      .split(/内容\d+:/g)
      .filter((block) => block.trim());

    // 解析每个内容块
    return contentBlocks.map((block) => {
      const sentimentMatch = block.match(/情感倾向：(正面|负面)/);
      const reasoningMatch = block.match(
        /分析理由：(.+?)(?=(?:\n\n|\n内容\d+:|$))/s,
      );

      return {
        result: sentimentMatch ? sentimentMatch[1] : "正面",
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : "未提供分析理由",
      };
    });
  } catch (error) {
    console.error("批量AI分析出错:", error);
    return dataList.map(() => ({
      result: "正面",
      reasoning: "分析过程出错，默认返回正面评价",
    }));
  }
}

// 添加读取已有Excel数据的函数
function getExistingLinks() {
  try {
    const filePath = path.join(
      __dirname,
      "小红书爬虫文件",
      "最新舆情数据.xlsx",
    );
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // 提取所有已存在的链接
    const existingLinks = data.map((row) => row["笔记链接"]);
    console.log(`已从Excel读取 ${existingLinks.length} 个已存在的链接`);
    return existingLinks;
  } catch (error) {
    console.log("读取已有Excel文件失败，可能是首次运行:", error.message);
    return [];
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: userDataDir,
    args: ["--no-sandbox", "--start-maximized"],
  });
  const page = await browser.newPage();

  // 获取已存在的链接
  const existingLinks = await getExistingLinks();

  // 设置关键词
  const keyword = "研选家";
  await page.goto(
    `https://www.xiaohongshu.com/search_result?keyword=${keyword}&source=web_search_result_notes&type=51`,
  );

  // 改用数组替代Set
  const uniqueHrefs = [];

  while (true) {
    const divList = await page.$$(".cover.ld.mask");
    for (const element of divList) {
      const href = await element.evaluate((el) => el.getAttribute("href"));
      if (href) {
        const fullHref =
          "https://www.xiaohongshu.com/explore/" + href.split("/")[2];
        // 检查是否已存在该链接，包括Excel中的历史数据
        if (
          !uniqueHrefs.includes(fullHref) &&
          !existingLinks.includes(fullHref)
        ) {
          uniqueHrefs.push(fullHref);
          console.log("找到新链接:", fullHref);
        }
      }
    }

    if (uniqueHrefs.length >= allNeedNums) break;

    await page.evaluate(() => window.scrollBy(0, 800));
    const endElement = await page.$("text/ - THE END -");
    if (endElement) break;

    await delay(1000);
  }

  console.log(`发现 ${uniqueHrefs.length} 个新链接需要爬取`);

  // 读取关键词文件
  const keywordWorkbook = XLSX.readFile(path.join(__dirname, "关键词.xlsx"));
  const keywords = XLSX.utils.sheet_to_json(
    keywordWorkbook.Sheets[keywordWorkbook.SheetNames[0]],
    { header: 1 },
  );
  // 将第3列和第4列的所有值合并到一个数组中，并处理顿号分割
  const keywordsArray = keywords.flatMap((row) => {
    const col3And4 = [row[2], row[3]].filter(Boolean);
    return col3And4.flatMap((keyword) => {
      if (typeof keyword === "string" && keyword.includes("、")) {
        return keyword.split("、");
      }
      return keyword;
    });
  });

  // 收集详细数据
  const dataList = [];
  // 遍历所有链接，获取数据
  for (const link of uniqueHrefs) {
    if (dataList.length >= allNeedNums) break;

    try {
      // 添加重试机制
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          await page.goto(link, {
            waitUntil: "networkidle0",
            timeout: 30000,
          });
          break; // 如果成功就跳出重试循环
        } catch (error) {
          retryCount++;
          console.log(`访问页面失败，第 ${retryCount} 次重试...`);
          if (retryCount === maxRetries) {
            console.error(`无法访问页面 ${link}，跳过此条数据`);
            continue; // 跳过当前链接
          }
          await delay(2000 * retryCount); // 递增等待时间
        }
      }

      await delay(3000);

      const data = await page.evaluate(() => {
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

        return {
          笔记标题: cleanText(getTextContent(".title")),
          笔记作者: cleanText(getTextContent(".username")),
          笔记时间: cleanText(getTextContent(".date")),
          笔记链接: window.location.href,
          笔记内容: noteContent,
          图片链接: imgLink,
          评论内容: commentContent,
        };
      });

      for (const keyword of keywordsArray) {
        if (data.笔记标题.includes(keyword)) {
          data.关键词 = keyword;
          console.log("找到了关键词", keyword);
        }
      }
      if (!data.关键词) {
        data.关键词 = "没有找到关键词";
        console.log("没有找到关键词");
      }

      dataList.push(data);
    } catch (error) {
      console.error(`处理链接 ${link} 时出错:`, error);
      continue;
    }
  }

  // 批量进行AI分析
  console.log("开始批量AI分析...");
  const aiResults = await analyzeWithAI(dataList);

  // 将AI分析结果添加到数据中
  dataList.forEach((data, index) => {
    data.ai分析 = aiResults[index].result;
    data.ai思考过程 = aiResults[index].reasoning;
  });

  console.log("数据采集完毕", dataList);

  // 最后保存一次
  await saveToExcel(dataList, "最新舆情数据.xlsx");
  console.log("已结束");
  await browser.close();
}

main().catch(console.error);

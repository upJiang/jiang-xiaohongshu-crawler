import OpenAI from "openai";

import type { AIAnalysisResult, NoteData } from "@/views/xiaohongshu/contants";

export async function analyzeWithAI(
  dataList: NoteData[],
): Promise<AIAnalysisResult[]> {
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    baseURL: "https://api.lkeap.cloud.tencent.com/v1",
    dangerouslyAllowBrowser: true,
  });

  try {
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
    const contentBlocks = analysisText!
      .split(/内容\d+:/g)
      .filter((block) => block.trim());

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

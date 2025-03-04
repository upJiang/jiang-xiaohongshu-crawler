import type { AIAnalysisResult, NoteData } from "@/views/xiaohongshu/contants";

export async function analyzeWithAI(
  dataList: NoteData[],
): Promise<AIAnalysisResult[]> {
  try {
    const contentToAnalyze = dataList
      .map(
        (data, index) =>
          `内容${index + 1}:
        标题：${data.笔记标题}
        内容：${data.笔记内容}`,
      )
      .join("\n\n");

    try {
      const response = await fetch(
        `https://api.siliconflow.cn/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-ai/DeepSeek-V3",
            messages: [
              {
                role: "system",
                content: `你是一位专业的舆情分析师。请分析每条内容并按以下格式返回结果：
              
                                  内容1:
                                  情感倾向：[正面/中性/负面]
                                  标签：[标签1, 标签2, ...]
                                  分析理由：[详细说明分析过程]
              
                                  内容2:
                                  情感倾向：[正面/中性/负面]
                                  标签：[标签1, 标签2, ...]
                                  分析理由：[详细说明分析过程]
              
                                  依此类推...
              
                                  分析规则：
                                  1. 关注内容中的情感词汇、评价性词语
                                  2. 考虑用户的表达方式和语气
                                  3. 分析内容对品牌形象的潜在影响
                                  4. 情感倾向判断标准：
                                     - 正面：表达赞美、满意、推荐等积极情感
                                     - 中性：客观描述事实、活动通知、普通分享等无明显情感倾向
                                     - 负面：表达不满、批评、投诉等消极情感
                                  5. 标签提取规则：
                                     - 正面标签例如：好评、推荐、性价比高、服务好、环境优美等
                                     - 中性标签例如：信息分享、活动通知、普通体验等
                                     - 负面标签例如：跑路了、脏乱差、服务差、价格虚高、质量问题等
                                     - 提取2-4个最能概括内容主题的标签`,
              },
              {
                role: "user",
                content: contentToAnalyze,
              },
            ],
            stream: false,
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.7,
            top_k: 50,
            frequency_penalty: 0.5,
          }),
        },
      );

      // 解析 JSON 响应
      const data = await response.json();
      console.log("API 返回数据：", data.choices[0].message.content);
      const analysisText = data.choices[0].message.content;
      const contentBlocks = analysisText!
        .split(/内容\d+:/g)
        .filter((block) => block.trim());

      return contentBlocks.map((block) => {
        const sentimentMatch = block.match(/情感倾向：(正面|中性|负面)/);
        const tagsMatch = block.match(/标签：(.+?)(?=\n分析理由)/);
        const reasoningMatch = block.match(
          /分析理由：(.+?)(?=(?:\n\n|\n内容\d+:|$))/s,
        );

        // 处理标签，将字符串转换为数组
        const tagsString = tagsMatch ? tagsMatch[1] : "";
        const tags = tagsString
          .split(/、|，|,\s*/)
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0 && tag !== "[" && tag !== "]");

        return {
          result: sentimentMatch ? sentimentMatch[1] : "中性",
          tags: tags.length > 0 ? tags.join("、") : "未提供标签",
          reasoning: reasoningMatch
            ? reasoningMatch[1].trim()
            : "未提供分析理由",
        };
      });
    } catch (error) {
      console.error("批量AI分析出错:", error);
      return dataList.map(() => ({
        result: "中性",
        tags: "分析出错",
        reasoning: "分析过程出错，默认返回中性评价",
      }));
    }
  } catch (error) {
    console.error("批量AI分析出错:", error);
    return dataList.map(() => ({
      result: "中性",
      tags: "分析出错",
      reasoning: "分析过程出错，默认返回中性评价",
    }));
  }
}

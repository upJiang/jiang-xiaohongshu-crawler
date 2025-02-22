export interface CrawlerConfig {
  keyword: string;
  allNeedNums: number;
}

export interface NoteData {
  笔记标题: string;
  笔记作者: string;
  笔记时间: string;
  发表城市: string;
  IP属地: string;
  笔记链接: string;
  笔记内容: string;
  图片链接: string;
  评论内容: string;
  关键词?: string;
  ai分析?: string;
  ai思考过程?: string;
}

export interface AIAnalysisResult {
  result: string;
  reasoning: string;
}

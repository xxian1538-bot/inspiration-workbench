import { AnomalyMetrics, defaultMetricSelection, metricSummary, normalizeMetricSelection, type MetricSelection } from "./components/AnomalyMetrics";
import { AlertRecipientPicker } from "./components/AlertRecipientPicker";
import { ArticleTopics, HotspotLevel, HotspotBadge, useTracked } from "./components/HotspotFeatures";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Sparkles, Users, MessageSquare, Globe, LayoutGrid, Calendar,
  Flame, TrendingUp, Bell, MoreHorizontal,
  Pencil, Brain, Video, Filter, Clock, RefreshCw,
  Zap, Newspaper, X, ExternalLink,
  Bookmark, Send, Wifi, Hash, CheckSquare, Lightbulb, Building2, BarChart2,
  Heart, Eye, Link, Download, Star, Tag, Plus, Grid3x3, List, Share2,
  ImageIcon, Film, Music2, Settings, MapPin, ShieldCheck, UserRound, Radio,
  Check, ChevronRight, ChevronLeft, Upload, Play, FileText,
} from "lucide-react";

import industryData from "./industryArticles.json";
import { ArticleSummarySection, type ArticleSummarySource, type ArticleSummaryMode } from "./components/ArticleSummarySection";
import { Toaster } from "./components/ui/sonner";
import { HolidayContent } from "./components/HolidayContent";
import { ViralVideoUploadDialog } from "./components/ViralVideoUploadDialog";
import { analyzeVideo, hasVideoAnalysisApi, workKey, type PlatformSnapshot, type VideoContentAnalysis, type VideoImport, type VideoWork } from "./components/viralVideoSources";

import { dateMatches, newsroomDaysBefore, readPreviewVideoTasks, savePreviewVideoTask, usePreviewSettings } from "./components/previewStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

type CardType =
  | "热门事件" | "早报" | "晚报" | "爆点" | "本地新闻"
  | "热搜" | "订阅更新" | "灵感" | "爆款视频" | "建议选题"
  | "竞品洞察" | "行业洞察";

type Card = {
  id: number;
  hotspotId?: string;
  type: CardType;
  platform: string;
  title: string;
  summary: string;
  // 热门事件 / 热搜 only
  keyPoints?: string[];
  topicSuggestion?: string;
  reason?: string;
  materials?: string[]; // image URLs or placeholder keys
  // 早报 / 晚报 only
  newsItems?: { headline: string; desc: string }[];
  // 建议选题 only
  topicName?: string;
  topicReason?: string;
  // 竞品洞察 only
  company?: string;
  productName?: string;
  productFeatures?: string[];
  originalUrl?: string;
  // 行业洞察 only
  docType?: string; // 政策/新闻/公文/报告
  // shared
  suggestion: string;
  tags: string[];
  source: string;
  time: string;
  heat?: number;
  isNew?: boolean;
  isHot?: boolean;
};

// ─── Tag color map ─────────────────────────────────────────────────────────────

const TYPE_META: Record<CardType, { label: string; bg: string; text: string }> = {
  "热门事件": { label: "热门事件", bg: "bg-rose-100",    text: "text-rose-600" },
  "热搜":     { label: "热搜",     bg: "bg-orange-100",  text: "text-orange-600" },
  "早报":     { label: "早报",     bg: "bg-amber-100",   text: "text-amber-700" },
  "晚报":     { label: "晚报",     bg: "bg-violet-100",  text: "text-violet-600" },
  "爆点":     { label: "爆点",     bg: "bg-purple-100",  text: "text-purple-600" },
  "本地新闻": { label: "本地新闻", bg: "bg-teal-100",    text: "text-teal-700" },
  "订阅更新": { label: "订阅更新", bg: "bg-blue-100",    text: "text-blue-600" },
  "灵感":     { label: "灵感",     bg: "bg-cyan-100",    text: "text-cyan-700" },
  "爆款视频": { label: "爆款视频", bg: "bg-pink-100",    text: "text-pink-600" },
  "建议选题": { label: "建议选题", bg: "bg-green-100",   text: "text-green-700" },
  "竞品洞察": { label: "竞品洞察", bg: "bg-slate-100",   text: "text-slate-700" },
  "行业洞察": { label: "行业洞察", bg: "bg-indigo-100",  text: "text-indigo-700" },
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const mockCards: Card[] = [
  {
    id: 1, type: "热门事件", platform: "微博", isHot: true, heat: 982,
    title: "王红收到了来自大学教授和学院的推荐信，引发广泛讨论",
    summary: "知名教育博主王红分享了她申请顶级研究生项目时收到的推荐信全文，引发网友对学术推荐信文化和教育公平的广泛讨论。",
    keyPoints: [
      "推荐信来自顶级院校教授，措辞专业且充满温度",
      "申请背景为顶尖学府的数据科学研究生项目",
      "引发网友对教育资源不平等的深度讨论",
    ],
    suggestion: "可结合教育公平话题进行深度报道，采访普通学子，讲述草根逆袭故事，探讨名校申请背后的资源壁垒。",
    topicSuggestion: "《推荐信背后的教育鸿沟》深度报道",
    reason: "事件触达教育焦虑核心痛点，话题热度持续攀升，受众共情度极高，适合深度纪实与观点评论双线推进。",
    materials: ["mat-1a", "mat-1b", "mat-1c"],
    tags: ["教育", "留学", "推荐信"], source: "微博热搜 #1", time: "2分钟前",
  },
  {
    id: 2, type: "早报", platform: "内部系统", isNew: true,
    title: "7月28日早报丨国务院数字经济新政 · 美联储维持利率 · 长江防汛升级",
    summary: "今日要闻速览，涵盖政策、金融、气象三大领域重要动态。",
    newsItems: [
      { headline: "国务院发布《数字经济促进条例》", desc: "重点支持中小企业数字化转型，推出税收减免政策，预计覆盖500万家企业。" },
      { headline: "美联储维持利率5.25%-5.50%不变", desc: "纳指涨1.2%，市场普遍预期年内降息两次，科技股全线回暖。" },
      { headline: "长江流域多处超警戒水位", desc: "应急响应提升至II级，湖北、安徽等省份启动防洪预案，转移群众逾12万人。" },
      { headline: "教育部出台新版课程标准", desc: "人工智能课程纳入义务教育必修，从小学四年级起开始系统学习编程思维。" },
    ],
    suggestion: "围绕数字经济政策展开系列报道：政策解读 + 企业案例 + 地方落地，形成完整报道链条。",
    tags: ["早报", "政策", "财经"], source: "内部早报系统", time: "08:00",
  },
  {
    id: 3, type: "热搜", platform: "知乎", heat: 456,
    title: "为什么越来越多的年轻人选择「躺平」而不是继续内卷？",
    summary: "知乎高赞问题持续发酵，获得1200+高质量回答，从职场压力延伸至代际价值观冲突、社会资源分配不均等深层议题。",
    keyPoints: [
      "躺平现象本质是对单一成功标准的反抗与自我保护",
      "Z世代正在重新定义「有意义的工作」",
      "企业用工模式和社会福利体系亟待响应新诉求",
    ],
    suggestion: "建议从普通年轻人视角切入，记录真实的躺平日记与内卷日记，形成对照，展现时代精神的多元面向。",
    topicSuggestion: "《不内卷的一代》人物纪实系列",
    reason: "话题已从网络讨论延伸至社会学层面，受众覆盖广，情绪共鸣强，当下时间窗口极佳，可做差异化深度报道。",
    materials: ["mat-2a", "mat-2b", "mat-2c"],
    tags: ["躺平", "年轻人", "社会观察"], source: "知乎热搜 #7", time: "2小时前",
  },
  {
    id: 4, type: "建议选题",
    title: "建议选题：城市绿化带背后的生态修复价值",
    topicName: "《绿色城市的另一面》深度系列报道",
    topicReason: "全国200+城市启动立体绿化试点，本地南山区绿化覆盖率三年提升12%，话题兼具政策时效性与市民关注度，碳汇经济概念正在成为新的传播热点。",
    summary: "",
    suggestion: "从工程、生态、人文三个维度切入，采访景观设计师、生态学家和普通市民，打造多维度深度报道，可做三集短视频系列。",
    tags: ["城市生态", "绿化", "本地", "深度"], source: "AI智能选题", time: "今天",
    isNew: true,
  },
  {
    id: 6, type: "晚报", platform: "内部系统",
    title: "7月27日晚报丨世界技能大赛中国夺冠 · 苹果发布新品 · 北京暴雨蓝色预警",
    summary: "今日晚间要闻汇总，三大板块重磅信息速览。",
    newsItems: [
      { headline: "世界技能大赛中国选手问鼎金牌", desc: "00后职校生在精密机械加工项目中以满分成绩夺冠，视频播放量突破1.5亿次。" },
      { headline: "苹果公司发布新一代MacBook Pro", desc: "搭载M4 Ultra芯片，性能较上代提升40%，起售价24999元，国行同步开售。" },
      { headline: "北京发布暴雨蓝色预警", desc: "明日上午将有大到暴雨，市气象局提醒市民注意出行安全，部分地铁站将临时限流。" },
    ],
    suggestion: "技能大赛夺冠是今日最具传播潜力的正能量内容，建议跟进职业教育系列策划。",
    tags: ["晚报", "科技", "体育"], source: "内部晚报系统", time: "20:00",
  },
  {
    id: 7, type: "爆款视频", platform: "抖音", isHot: true, heat: 1520,
    title: "小写的又一次向世界展示中国——职校00后世界技能大赛满分夺冠",
    summary: "在韩国首尔举办的第46届世界技能大赛上，一位来自职业院校的00后选手在精密机械加工项目中以满分成绩夺冠，单条视频播放突破1.5亿，话题阅读量破30亿。",
    suggestion: "深度跟踪报道，走进职业院校展现技能人才培养体系，可做系列短视频《中国技能》，用年轻化语态讲述大国工匠精神。",
    tags: ["技能大赛", "职业教育", "正能量"], source: "抖音热榜 #3", time: "3小时前",
  },
  {
    id: 8, type: "订阅更新", platform: "微博",
    title: "@营养师科普 最新发布丨肠道菌群与免疫力的关联——你的肠道决定了你80%的健康",
    summary: "关注账号@营养师科普（粉丝382万）发布了关于肠道菌群与免疫系统关联的科普内容，文章从肠脑轴理论出发，结合最新医学研究成果，系统阐释肠道健康对整体健康的决定性影响。",
    suggestion: "健康科普赛道持续火热，可策划《肠道革命》系列，结合中国饮食文化特色（泡菜、豆豉等发酵食品），制作符合本土受众的科普内容。",
    tags: ["健康", "营养", "科普"], source: "@营养师科普 · 微博", time: "4小时前",
  },
  {
    id: 9, type: "灵感",
    title: "灵感｜在地老人口述历史项目——用声音留住城市记忆",
    summary: "日本一个公民新闻项目通过采访100位80岁以上老人，记录城市半个世纪的变迁史，产出播客、书籍和互动地图三种形式，获得新闻创新大奖。这一模式非常适合本土化复制。",
    suggestion: "可在本地社区发起《口述城市》项目，整合视频采访、地图可视化和音频故事，联动社区图书馆和文化馆，形成长期内容矩阵。",
    tags: ["灵感", "口述历史", "社区"], source: "灵感推荐系统", time: "今天",
  },
  {
    id: 10, type: "爆点", isHot: true,
    title: "媒体信任危机报告：年轻人对新闻可信度降至近20年最低点",
    summary: "最新研究报告揭示，18-35岁群体对主流媒体新闻的信任度仅为23%，为近20年最低。用户更倾向于从短视频平台和社交媒体获取资讯，这一趋势在Z世代中尤为突出。",
    suggestion: "建议策划《我们还相信什么》专题，从用户视角切入，深度访谈不同年龄层对媒体的信任态度，同时展示媒体自救的创新尝试。",
    tags: ["媒体", "信任危机", "Z世代"], source: "Reuters调研报告", time: "1小时前",
  },
  {
    id: 11, type: "本地新闻",
    title: "深圳南山科技园扩容计划获批：新增50万平米研发空间，引入百家硬科技企业",
    summary: "深圳市规划和自然资源局正式批复南山科技园三期扩容方案，新增50万平方米研发用地，重点引入半导体、量子计算、生命科学等硬科技企业，预计2027年投入使用。",
    suggestion: "跟踪报道扩容背后的产业链布局，采访入驻企业和区政府官员，探讨深圳科技创新的下一个十年。",
    tags: ["本地", "科技园", "产业"], source: "深圳商报", time: "5小时前",
  },
  {
    id: 12, type: "建议选题", isNew: true,
    title: "建议选题：外卖骑手的职业认同与数字劳工困境",
    topicName: "《骑在风口上》——新就业形态深度调查",
    topicReason: "平台经济用工问题持续引发社会关注，劳动保障新规落地在即，骑手群体规模超过700万人，话题与民生高度相关，传播潜力极强。",
    summary: "",
    suggestion: "建议跟踪3-5名不同背景骑手一周，记录真实工作状态，同时采访平台方、监管部门和劳动法学者，形成多声部的深度调查报道。",
    tags: ["选题", "劳动", "平台经济"], source: "AI智能选题", time: "今天",
  },
  {
    id: 13, type: "竞品洞察", isNew: true,
    title: "字节跳动发布「即梦AI」视频生成2.0：支持4K输出与多角色一致性控制",
    summary: "字节跳动旗下即梦AI正式推出视频生成2.0版本，主打4K分辨率输出与跨镜头多角色一致性，面向影视制作和广告创意行业，对标Sora与Runway Gen-3。",
    company: "字节跳动",
    productName: "即梦AI 视频生成2.0",
    productFeatures: [
      "支持4K分辨率视频生成，时长最长60秒",
      "多角色一致性控制，跨镜头人物形象稳定",
      "内置导演视角模式，支持运镜指令",
      "API开放，广告主可直接接入自动化生产流程",
    ],
    originalUrl: "https://example.com",
    suggestion: "竞品发力AI视频创作工具，建议策划「AI视频工具横评」选题，从记者视角测评主流产品，输出差异化的专业评测内容。",
    tags: ["竞品", "AI视频", "字节跳动"], source: "竞品情报", time: "3小时前",
  },
  {
    id: 14, type: "竞品洞察",
    title: "腾讯混元大模型发布长文档理解能力：支持100万Token上下文，面向企业知识管理",
    summary: "腾讯混元大模型最新版本将上下文窗口扩展至100万Token，重点优化企业级长文档理解与知识问答场景，已在腾讯会议、企业微信中灰度上线。",
    company: "腾讯",
    productName: "混元大模型 长上下文版",
    productFeatures: [
      "100万Token超长上下文，支持整本书级别分析",
      "企业私有知识库接入，数据不出域",
      "已集成腾讯会议纪要自动生成功能",
    ],
    originalUrl: "https://example.com",
    suggestion: "大模型长上下文竞争加剧，可策划「谁能读懂一本书」专题，测试主流大模型对长文档的理解能力，触达企业用户群体。",
    tags: ["竞品", "大模型", "腾讯"], source: "竞品情报", time: "昨天",
  },
  {
    id: 15, type: "行业洞察", isNew: true,
    title: "国家互联网信息办公室：《生成式人工智能服务管理暂行办法》修订版正式征求意见",
    summary: "国家网信办发布《生成式人工智能服务管理暂行办法（修订版）》公开征求意见稿，新增对AI生成内容标注义务、训练数据版权合规要求，以及面向未成年人的内容过滤强制标准。",
    docType: "政策法规",
    keyPoints: [
      "AI生成内容须强制显著标注，违者最高罚款50万元",
      "训练数据须取得著作权人授权，平台承担连带责任",
      "面向18岁以下用户须开启青少年模式，限制特定内容类别",
    ],
    suggestion: "政策直接影响AI内容平台合规成本，建议策划《AI监管元年》深度解读，采访法律专家和平台方，梳理合规路径。",
    tags: ["政策", "AI监管", "网信办"], source: "国家网信办", time: "今天",
  },
  {
    id: 16, type: "行业洞察",
    title: "Reuters最新报告：2025年全球媒体行业AI采纳率达67%，但78%记者担忧准确性",
    summary: "路透社新闻研究院发布年度《数字新闻报告2025》，调研覆盖46个国家92家媒体机构，显示AI工具在内容生产、数据新闻、广告自动化领域渗透迅速，但媒体人对AI幻觉与版权问题的担忧同步上升。",
    docType: "行业报告",
    suggestion: "报告数据直接关联编辑部AI转型决策，建议以此为基础策划《中国媒体AI化现状》调查报道，对标国际数据，展现中外差异。",
    tags: ["行业报告", "AI", "媒体"], source: "Reuters研究院", time: "2天前",
  },
];

// ─── Infinite scroll helpers ───────────────────────────────────────────────────

function generateCards(base: Card[], page: number): Card[] {
  return base.map((c, i) => ({
    ...c,
    id: (page - 1) * base.length + i + 1,
    time: page === 1 ? c.time : `${page * 2 + i + 1}分钟前`,
  }));
}

// ─── Action Buttons ────────────────────────────────────────────────────────────

const actionButtons = [
  { id: "report",   icon: <Send size={11} />,    label: "去报题" },
  { id: "create",   icon: <Pencil size={11} />,  label: "去创作" },
  { id: "ai",       icon: <Brain size={11} />,   label: "AI灵感搜索" },
  { id: "video",    icon: <Video size={11} />,   label: "短视频混剪" },
];

// ─── Card Component ────────────────────────────────────────────────────────────

function InspirationCard({ card, onOpen }: { card: Card; onOpen: (card: Card) => void }) {
  const [hovered, setHovered] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const isHotOrTrend  = card.type === "热门事件" || card.type === "热搜";
  const isBriefing    = card.type === "早报" || card.type === "晚报";
  const isTopic       = card.type === "建议选题";
  const isCompetitor  = card.type === "竞品洞察";
  const isIndustry    = card.type === "行业洞察";

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-white border border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200 group break-inside-avoid mb-3 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(card)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(card);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* ── Light header ── */}
      <div className="px-3 py-2.5 bg-muted/35 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 text-[11px] font-semibold text-foreground">
            {card.type}
          </span>
          {card.hotspotId && <HotspotBadge id={card.hotspotId} />} 
          {card.docType && (
            <span className="text-[11px] text-foreground">{card.docType}</span>
          )}
          {card.heat && (
            <span className="flex items-center gap-0.5 text-[11px] text-orange-500 ml-auto">
              <TrendingUp size={10} />{card.heat}万
            </span>
          )}
        </div>
      </div>

      {/* ── White body ── */}
      <div className="bg-card px-3 pt-3 pb-2.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug mb-2.5 line-clamp-2 group-hover:text-primary transition-colors">
          {card.title}
        </h3>

        {/* ── Type-specific body ── */}

        {isHotOrTrend && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">{card.summary}</p>
            {card.keyPoints && (
              <ul className="space-y-1 mb-2">
                {card.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold mt-0.5">{i + 1}</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {isBriefing && card.newsItems && (
          <ul className="space-y-2 mb-2">
            {card.newsItems.map((item, i) => (
              <li key={i} className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">· {item.headline}</span>
                <span className="text-muted-foreground ml-1">{item.desc}</span>
              </li>
            ))}
          </ul>
        )}

        {isTopic && (
          <div className="space-y-2 mb-2">
            <div className="bg-green-50 border border-green-100 rounded-lg px-2.5 py-2">
              <div className="text-[11px] font-semibold text-green-700 mb-0.5 flex items-center gap-1">
                <Lightbulb size={10} /> 选题名称
              </div>
              <p className="text-xs font-medium text-foreground">{card.topicName}</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">选题原因</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.topicReason}</p>
            </div>
          </div>
        )}

        {isCompetitor && (
          <div className="space-y-2 mb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 size={11} className="flex-shrink-0" />
              <span className="font-medium text-foreground">{card.company}</span>
              <span className="text-muted-foreground">·</span>
              <span>{card.productName}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{card.summary}</p>
            {card.productFeatures && (
              <ul className="space-y-1">
                {card.productFeatures.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="flex-shrink-0 w-1 h-1 rounded-full bg-slate-400 mt-1.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {card.originalUrl && (
              <a
                href={card.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
              >
                <ExternalLink size={10} /> 查看原文
              </a>
            )}
          </div>
        )}

        {isIndustry && (
          <div className="space-y-2 mb-2">
            <p className="text-xs text-muted-foreground leading-relaxed">{card.summary}</p>
            {card.keyPoints && (
              <ul className="space-y-1">
                {card.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-bold mt-0.5">{i + 1}</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isHotOrTrend && !isBriefing && !isTopic && !isCompetitor && !isIndustry && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{card.summary}</p>
        )}

        {/* Creation suggestion */}
        {isHotOrTrend ? (
          <div className="space-y-2 mb-2.5">
            {/* 推荐理由 */}
            <div className="bg-rose-50 rounded-lg px-2.5 py-2">
              <div className="text-[11px] font-semibold text-rose-600 mb-0.5 flex items-center gap-1">
                <Zap size={10} /> 推荐理由
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.reason}</p>
            </div>
            {/* 选题建议 */}
            <div className="bg-secondary/60 rounded-lg px-2.5 py-2">
              <div className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                <Lightbulb size={10} /> 选题建议
              </div>
              <p className="text-xs text-foreground font-medium leading-relaxed">{card.topicSuggestion}</p>
            </div>
            {/* 创作角度建议 */}
            <div className="bg-indigo-50 rounded-lg px-2.5 py-2">
              <div className="text-[11px] font-semibold text-indigo-600 mb-0.5 flex items-center gap-1">
                <Sparkles size={10} /> 创作角度建议
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.suggestion}</p>
            </div>
            {/* 推荐素材 */}
            {card.materials && card.materials.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Download size={10} /> 推荐素材
                </div>
                <div className="flex gap-1.5">
                  {card.materials.map((mat, i) => {
                    const mediaTypes = [
                      { icon: <ImageIcon size={14} />, label: "图片", bg: "from-blue-200 to-indigo-300", iconColor: "text-blue-600", badgeBg: "bg-blue-500" },
                      { icon: <Film size={14} />,      label: "视频", bg: "from-slate-300 to-slate-500", iconColor: "text-slate-600", badgeBg: "bg-slate-600" },
                      { icon: <Music2 size={14} />,    label: "音频", bg: "from-amber-100 to-orange-200", iconColor: "text-orange-500", badgeBg: "bg-orange-400" },
                    ];
                    const mt = mediaTypes[i % mediaTypes.length];
                    return (
                      <div
                        key={mat}
                        className="flex-1 aspect-[4/3] rounded-lg overflow-hidden relative group cursor-pointer border border-border"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${mt.bg}`} />
                        {/* Media type icon badge */}
                        <div className="absolute top-1.5 left-1.5">
                          <div className={`${mt.badgeBg} text-white rounded-md px-1.5 py-0.5 flex items-center gap-0.5`}>
                            <span className="text-white">{mt.icon}</span>
                            <span className="text-[9px] font-semibold">{mt.label}</span>
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="bg-black/50 text-white text-[9px] px-1 py-0.5 rounded">素材 {i + 1}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-secondary/60 rounded-lg px-2.5 py-2 mb-2.5">
            <div className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
              <Sparkles size={10} /> 创作建议
            </div>
            <p className="text-xs text-muted-foreground">{card.suggestion}</p>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span key={tag} className="text-[11px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Hover more button */}
      {hovered && !actionsOpen && (
        <button
          onClick={(event) => { event.stopPropagation(); setActionsOpen(true); }}
          className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-primary text-white text-xs px-2.5 py-1 rounded-full shadow-lg hover:bg-primary/90 transition-all"
        >
          <MoreHorizontal size={12} /> 更多
        </button>
      )}

      {/* Expanded actions overlay */}
      {actionsOpen && (
        <div onClick={(event) => event.stopPropagation()} className="absolute inset-0 bg-foreground/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 rounded-xl z-10">
          <div className="flex flex-wrap gap-2 px-4 justify-center">
            {actionButtons.map((btn) => (
              <button key={btn.id} className="flex items-center gap-1.5 text-[12px] text-foreground/70 px-3.5 py-1.5 rounded-full border border-border bg-white hover:border-primary/40 hover:text-primary transition-all">
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
          <button onClick={() => setActionsOpen(false)} className="flex items-center gap-1 text-white/70 hover:text-white text-xs">
            <X size={12} /> 关闭
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Nav items with icon style ─────────────────────────────────────────────────

type NavDef = {
  id: string;
  label: string;
  subtitle?: string;
  iconBg: string;
  icon: React.ReactNode;
  isNew?: boolean;
};

const navDefs: NavDef[] = [
  { id: "home",     label: "灵感工作台",     subtitle: "信息流总览",   iconBg: "from-blue-500 to-indigo-600",   icon: <LayoutGrid size={18} className="text-white" /> },
  { id: "ai",       label: "灵感AI搜索",     subtitle: "发现新闻线索", iconBg: "from-purple-500 to-violet-600", icon: <Brain size={18} className="text-white" /> },
  { id: "social",   label: "社媒热门话题",                              iconBg: "from-orange-400 to-rose-500",   icon: <Hash size={18} className="text-white" /> },
  { id: "accounts", label: "社媒账号订阅",                              iconBg: "from-blue-400 to-blue-600",     icon: <Users size={18} className="text-white" /> },
  { id: "sites",    label: "站点订阅",                                  iconBg: "from-sky-400 to-cyan-600",      icon: <Globe size={18} className="text-white" /> },
  { id: "news",     label: "分类资讯",                                  iconBg: "from-blue-500 to-blue-700",     icon: <Wifi size={18} className="text-white" /> },
  { id: "briefing",   label: "新闻早晚报",   subtitle: "每日定时简报",  iconBg: "from-amber-400 to-orange-500",  icon: <Newspaper size={18} className="text-white" />, isNew: true },
  { id: "hotevents",  label: "潜在热点事件", subtitle: "同城热搜·民生",  iconBg: "from-red-400 to-rose-600",      icon: <Flame size={18} className="text-white" />,    isNew: true },
  { id: "competitor", label: "竞品跟踪",     subtitle: "账号·产品动态",  iconBg: "from-violet-500 to-purple-700", icon: <BarChart2 size={18} className="text-white" />, isNew: true },
  { id: "industry",   label: "行业洞察",     subtitle: "政策·资讯·客户", iconBg: "from-cyan-500 to-blue-600",     icon: <Globe size={18} className="text-white" />,    isNew: true },
  { id: "calendar", label: "节日节气",        subtitle: "营销节日不放过", iconBg: "from-purple-400 to-fuchsia-600", icon: <Calendar size={18} className="text-white" /> },
  { id: "viral-analysis", label: "爆款智能拆解", subtitle: "分镜·节奏·策略", iconBg: "from-rose-500 to-orange-500", icon: <Film size={18} className="text-white" />, isNew: true },
];

// ─── Platform list (secondary panel) ──────────────────────────────────────────

const platforms = [
  { id: "weibo",       name: "微博热搜",  icon: "微", color: "#E6162D", count: 50 },
  { id: "douyin",      name: "抖音热搜",  icon: "抖", color: "#161823", count: 36 },
  { id: "weixin",      name: "微信热搜",  icon: "微", color: "#07C160", count: 28 },
  { id: "baidu",       name: "百度热搜",  icon: "百", color: "#2932E1", count: 50 },
  { id: "toutiao",     name: "头条热搜",  icon: "头", color: "#E03E2D", count: 30 },
  { id: "xiaohongshu", name: "小红书",    icon: "红", color: "#FF2442", count: 30 },
  { id: "zhihu",       name: "知乎热搜",  icon: "知", color: "#0066FF", count: 50 },
  { id: "kuaishou",    name: "快手热搜",  icon: "快", color: "#FF4906", count: 30 },
  { id: "bilibili",    name: "哔哩哔哩",  icon: "B",  color: "#FB7299", count: 30 },
  { id: "xueqiu",      name: "雪球热搜",  icon: "雪", color: "#3DA75E", count: 30 },
];

// ─── Sub-pages ─────────────────────────────────────────────────────────────────

function AISearchPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [activeMode, setActiveMode] = useState<"web" | "timeline" | "deep" | "factcheck">("web");

  const modes = [
    { id: "web",       label: "看全网报道", icon: <Globe size={13} />,   filled: true },
    { id: "timeline",  label: "看事件脉络", icon: <TrendingUp size={13} /> },
    { id: "deep",      label: "深入研究",   icon: <Brain size={13} /> },
    { id: "factcheck", label: "新闻事实核查", icon: <CheckSquare size={13} />, hot: true },
  ] as const;

  const hotSuggestions = ["短视频爆款", "教育政策解读", "AI监管新规", "科技创新", "乡村振兴"];

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
      {/* ── Hero banner ── */}
      <div
        className="relative rounded-2xl overflow-hidden mb-8 flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #5B6EE8 0%, #7B8FF5 40%, #9BA8F8 70%, #B8C0FA 100%)", minHeight: 120 }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full opacity-40" style={{ background: "radial-gradient(circle, #F72585, #7209B7)" }} />
        <div className="absolute top-2 left-16 w-16 h-16 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #4CC9F0, #4361EE)" }} />
        <div className="absolute -bottom-4 -right-4 w-28 h-28 rounded-full opacity-35" style={{ background: "radial-gradient(circle, #4361EE, #3A0CA3)" }} />
        <div className="absolute top-3 right-20 w-10 h-10 rounded-full opacity-50 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
          <Zap size={18} className="text-white" />
        </div>
        {/* Text */}
        <div className="relative z-10 flex flex-col items-center justify-center py-8 px-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-1 tracking-wide">灵感AI搜索</h1>
          <p className="text-white/75 text-sm">—— 快速发现热点话题创作灵感</p>
        </div>
      </div>

      {/* ── Search area ── */}
      <div className="flex flex-col items-center flex-1">
        <h2 className="text-lg font-semibold text-foreground mb-5">灵感AI搜索，你的创作引擎</h2>

        <div className="w-full max-w-[560px]">
          {/* Textarea box */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden focus-within:border-primary/60 focus-within:shadow-md transition-all">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); } }}
              placeholder="请输入，Enter键发送，Shift+Enter键换行"
              rows={4}
              className="w-full px-4 pt-4 pb-2 text-sm text-foreground placeholder:text-muted-foreground bg-transparent outline-none resize-none leading-relaxed"
            />
            {/* Bottom bar inside textarea */}
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors">
                  + 灵媒报道
                </span>
              </div>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ background: query ? "#4361EE" : "#C7D0F8" }}
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>

          {/* Mode buttons */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {modes.map((mode) => {
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setActiveMode(mode.id)}
                  className={`relative flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border font-medium transition-all ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-foreground border-border hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {mode.icon}
                  {mode.label}
                  {mode.hot && (
                    <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                      HOT
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hot suggestions */}
          <div className="mt-6 flex flex-wrap items-center gap-2 justify-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Flame size={11} className="text-orange-400" /> 热门话题：</span>
            {hotSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-xs text-muted-foreground border border-border px-2.5 py-1 rounded-full hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialPage() {
  const accounts = [
    { name: "人民日报",  platform: "微博", fans: "2341万", cat: "官方媒体", color: "#E6162D" },
    { name: "央视新闻",  platform: "抖音", fans: "1.2亿",  cat: "官方媒体", color: "#161823" },
    { name: "丁香医生",  platform: "微信", fans: "1800万", cat: "医疗健康", color: "#07C160" },
    { name: "虎嗅网",    platform: "微博", fans: "350万",  cat: "科技财经", color: "#E6162D" },
    { name: "半佛仙人",  platform: "B站",  fans: "920万",  cat: "财经科普", color: "#FB7299" },
  ];
  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">社媒账号订阅</h2>
        <button className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-primary/90">
          <Users size={12} /> 添加账号
        </button>
      </div>
      {accounts.map((a, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: a.color }}>{a.name[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.platform} · {a.fans}粉丝 · {a.cat}</div>
          </div>
          <button className="text-xs text-primary border border-primary/30 px-2.5 py-1 rounded-full hover:bg-primary hover:text-white transition-colors">已订阅</button>
        </div>
      ))}
    </div>
  );
}

const calendarEvents = [
  { date: "01/01", name: "元旦", description: "公历新年的第一天。常见内容包括跨年活动、新年愿望与城市新年见闻。" },
  { date: "02/02", name: "世界湿地日", description: "关注湿地保护与生物多样性，可从身边的湖泊、滩涂和候鸟观察切入。" },
  { date: "03/08", name: "国际劳动妇女节", description: "关注女性在劳动、社会和公共生活中的参与，可记录不同职业和年龄的女性故事。" },
  { date: "04/22", name: "世界地球日", description: "关注地球环境与生态保护，可结合社区环保行动、低碳生活和城市生态开展报道。" },
  { date: "05/01", name: "国际劳动节", description: "关注劳动者的日常、技能传承和劳动环境，也适合记录节日期间坚守岗位的人。" },
  { date: "06/01", name: "儿童节", description: "围绕儿童成长和权益，记录校园活动、亲子陪伴与儿童友好空间。" },
  { date: "07/01", name: "建党纪念日", description: "可围绕地方党史、红色档案和基层党员的工作展开报道。" },
  { date: "08/01", name: "建军节", description: "可从军史档案、国防教育和军地共建等角度开展报道。" },
  { date: "09/10", name: "教师节", description: "可记录教师的教学实践、师生故事和学校教育中的变化。" },
  { date: "10/16", name: "世界粮食日", description: "关注粮食安全、粮食生产与减少浪费，可跟踪一份粮食从田间到餐桌的过程。" },
  { date: "10/18", name: "重阳节", description: "重阳节在农历九月初九。登高、赏菊和敬老是常见习俗，可结合社区适老服务或家庭陪伴开展报道。" },
  { date: "10/23", name: "霜降", description: "霜降是秋季最后一个节气。各地降温和初霜时间有所差异，可结合当地气候、秋收和田间管理观察。" },
  { date: "10/24", name: "程序员节", description: "围绕技术工作者的非正式节日，适合记录软件团队的日常、开源协作或技术如何解决具体问题。" },
  { date: "11/01", name: "万圣节", description: "万圣节在公历 11 月 1 日，装扮和南瓜灯等活动多在前一晚举行。可关注节庆习俗与本地文旅活动。" },
  { date: "11/07", name: "立冬", description: "立冬是冬季的第一个节气。可观察不同地区的入冬节奏、冬藏习俗和农事准备。" },
  { date: "11/22", name: "小雪", description: "小雪是二十四节气中的第二十个节气，通常在公历 11 月 22 日前后。此时气温进一步下降，部分地区开始出现降雪。传统习俗中，一些地方会腌菜、制腊肉，为过冬做准备。小雪也是农事活动的重要节点，可关注越冬作物防寒、各地入冬变化和初雪带来的生活影响。" },
  { date: "11/26", name: "感恩节", description: "美国感恩节在 11 月的第四个星期四。可围绕节日习俗、家庭聚会或社区公益活动了解不同文化中的表达方式。" },
  { date: "12/01", name: "世界艾滋病日", description: "聚焦艾滋病防治知识、公共卫生服务和反歧视，报道时可核对权威机构发布的防治信息。" },
  { date: "12/07", name: "大雪", description: "大雪是冬季的第三个节气。可观察各地降雪、冬季交通、农业防寒和群众生活的变化。" },
  { date: "12/13", name: "南京大屠杀死难者国家公祭日", description: "纪念南京大屠杀死难者，铭记历史。可围绕公祭活动、档案、证言与和平教育开展报道。" },
  { date: "12/20", name: "澳门回归纪念日", description: "纪念澳门于 1999 年 12 月 20 日回归祖国。可回顾澳门发展与跨境交流，记录当地纪念活动。" },
  { date: "12/22", name: "冬至", description: "冬至前后，北半球白昼时间达到全年最低。可关注各地的冬至食俗、家庭聚会和冬季农事。" },
];

const calendarHolidayNames = calendarEvents.map((event) => event.name);

function CalendarPage() {
  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
  const currentDate = `${currentMonth}/${String(today.getDate()).padStart(2, "0")}`;
  const monthEvents = calendarEvents.filter((event) => event.date.startsWith(currentMonth));
  const currentEvent = monthEvents.find((event) => event.date >= currentDate) ?? monthEvents[monthEvents.length - 1];
  const [activeEvent, setActiveEvent] = useState(currentEvent);
  const [chosenEvent, setChosenEvent] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (list && selected) {
      list.scrollTop = selected.offsetTop - (list.clientHeight - selected.offsetHeight) / 2;
    }
  }, []);

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [activeEvent.date]);

  const returnToCurrentMonth = () => {
    setActiveEvent(currentEvent);
    if (monthRef.current) listRef.current?.scrollTo({ top: monthRef.current.offsetTop });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-white p-3 sm:p-4 min-[760px]:flex-row min-[760px]:gap-5">
      <section aria-label="节日节气日历" className="flex h-60 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-slate-50 min-[760px]:h-auto min-[760px]:w-56 lg:w-60">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold text-foreground">日历</h2>
          <button type="button" onClick={returnToCurrentMonth} className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-primary hover:bg-blue-200">回到本月</button>
        </div>
        <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
            <section key={month}>
              <h3 ref={month === currentMonth ? monthRef : undefined} className="py-3 text-center text-xs font-semibold text-foreground">{Number(month)}月</h3>
              <div className="space-y-2">
                {calendarEvents.filter((event) => event.date.startsWith(month)).map((event) => (
                  <button
                    key={event.date}
                    type="button"
                    aria-pressed={activeEvent.date === event.date}
                    onClick={() => setActiveEvent(event)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-[#edf3fa] px-3 py-2.5 text-xs leading-relaxed text-slate-600 hover:bg-blue-100 aria-pressed:bg-primary aria-pressed:text-white"
                  >
                    <span className="shrink-0 tabular-nums">{event.date}</span>
                    <span className="text-right">{event.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section ref={detailRef} aria-labelledby="calendar-details-heading" className="min-w-0 flex-1 min-[760px]:overflow-y-auto">
        <h2 id="calendar-details-heading" className="text-sm font-semibold text-foreground">节日详情</h2>
        <div className="mt-5 min-[760px]:mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-foreground">
              <h3>{activeEvent.name}</h3>
              <span className="tabular-nums">{activeEvent.date}</span>
            </div>
            <button
              type="button"
              disabled={chosenEvent === activeEvent.date}
              onClick={() => setChosenEvent(activeEvent.date)}
              className="rounded-full bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90 disabled:bg-blue-50 disabled:text-primary"
            >
              {chosenEvent === activeEvent.date ? "已选择" : "选择该节日"}
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activeEvent.description}</p>
        </div>
        <HolidayContent key={activeEvent.date} holiday={activeEvent} holidays={calendarHolidayNames} />
      </section>
    </div>
  );
}

function PlaceholderPage({ nav }: { nav: NavDef }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <div className={`w-14 h-14 bg-gradient-to-br ${nav.iconBg} rounded-2xl flex items-center justify-center shadow-lg`}>
        {nav.icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-1">{nav.label}</h2>
        {nav.subtitle && <p className="text-sm text-muted-foreground">{nav.subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Inspire Assistant Page ────────────────────────────────────────────────────

const INSPIRE_CATS = [
  { id: "all",     label: "所有链接",  icon: <Grid3x3 size={13} /> },
  { id: "starred", label: "已收藏",    icon: <Star size={13} /> },
  { id: "article", label: "文章",      icon: <Newspaper size={13} /> },
  { id: "video",   label: "视频",      icon: <Video size={13} /> },
  { id: "product", label: "产品/工具", icon: <Globe size={13} /> },
  { id: "policy",  label: "政策资讯",  icon: <CheckSquare size={13} /> },
  { id: "case",    label: "案例参考",  icon: <Lightbulb size={13} /> },
];

const INSPIRE_TAGS = ["AI创作", "媒体融合", "内容营销", "短视频", "深度报道", "竞品", "行业报告", "创意参考"];

type InspireItem = {
  id: number;
  category: string;
  starred?: boolean;
  title: string;
  url: string;
  domain: string;
  addedAt: string;
  coverColor: string;
  coverEmoji?: string;
  aiInsight: string;
  aiTags: string[];
  readTime?: string;
};

const inspireItems: InspireItem[] = [
  {
    id: 1, category: "article", starred: true,
    title: "SNOWY系统用国产用户信息_周报.docx",
    url: "https://feishu.cn/docs/example", domain: "feishu.cn",
    addedAt: "7天前", coverColor: "#4361EE", coverEmoji: "📄",
    aiInsight: "飞书内部文档，涉及国产系统用户增长数据，可用于竞品分析和行业趋势判断。关键数据：周活跃用户提升23%，企业客户签约率环比+15%。",
    aiTags: ["竞品", "数据报告"], readTime: "8分钟",
  },
  {
    id: 2, category: "product", starred: true,
    title: "BRTVs三年广告媒体传播形势分析报告（2034.A）.pdf",
    url: "https://example.com/report", domain: "example.com",
    addedAt: "7天前", coverColor: "#7209B7", coverEmoji: "📊",
    aiInsight: "广告媒体传播形势报告，数据显示短视频广告占比已突破45%，程序化购买成主流，传统媒体广告预算连续三年下滑。",
    aiTags: ["行业报告", "广告", "媒体"],
  },
  {
    id: 3, category: "article",
    title: "「元宇宙」广告厂商传播势能分析，近5年的重要关注点！",
    url: "https://mp.weixin.qq.com/example", domain: "微信公众号",
    addedAt: "7天前", coverColor: "#06D6A0", coverEmoji: "🌐",
    aiInsight: "梳理了元宇宙概念在广告行业的5年演变，指出2023年热度峰值后回落，但XR营销场景在奢侈品行业仍有增长空间。",
    aiTags: ["元宇宙", "内容营销", "创意参考"], readTime: "12分钟",
  },
  {
    id: 4, category: "product",
    title: "Webpage: mac.vs.github.io",
    url: "https://mac.vs.github.io", domain: "github.io",
    addedAt: "今天", coverColor: "#161823", coverEmoji: "⚙️",
    aiInsight: "Mac与GitHub工具链对比页面，记录了主流开发工具的性能基准测试，可用于技术栏目内容参考。",
    aiTags: ["工具", "技术"], readTime: "5分钟",
  },
  {
    id: 5, category: "article", starred: true,
    title: "今天之发现：科技新闻里的隐性叙事框架——谁在定义「创新」",
    url: "https://medium.com/example", domain: "medium.com",
    addedAt: "2天前", coverColor: "#F72585", coverEmoji: "📰",
    aiInsight: "深度媒介批评文章，分析科技媒体如何通过议题设置影响公众对「创新」的认知。论点鲜明，适合作为媒体素养选题的参考材料。",
    aiTags: ["深度报道", "媒体研究", "AI创作"], readTime: "18分钟",
  },
  {
    id: 6, category: "video",
    title: "全民运动上心头！看短视频如何把健康焦虑变成传播爆款……",
    url: "https://douyin.com/example", domain: "抖音",
    addedAt: "3天前", coverColor: "#FF8C00", coverEmoji: "🎬",
    aiInsight: "分析健康类短视频的情绪触发机制，总结出「制造焦虑→给出方案→成功案例」的三段式爆款公式，对内容策划有直接借鉴价值。",
    aiTags: ["短视频", "内容营销", "创意参考"],
  },
  {
    id: 7, category: "case",
    title: "温室量子扫描城市，有了多媒体，现在你们用媒体拍摄合适不了解？",
    url: "https://example.com", domain: "example.com",
    addedAt: "5天前", coverColor: "#4CC9F0", coverEmoji: "🏙️",
    aiInsight: "智慧城市可视化报道案例，使用3D点云扫描技术还原城市空间，展示了数据新闻与沉浸式叙事结合的创新路径。",
    aiTags: ["案例参考", "数据新闻", "深度报道"],
  },
  {
    id: 8, category: "article",
    title: "News from the Universe — How NASA communicates science to the public",
    url: "https://nasa.gov/example", domain: "nasa.gov",
    addedAt: "6天前", coverColor: "#0B0033", coverEmoji: "🚀",
    aiInsight: "NASA科普传播方法论文章，分析其如何将复杂科学概念转化为大众可理解的叙事，对科技报道写作有参考价值。",
    aiTags: ["案例参考", "科普", "创意参考"], readTime: "15分钟",
  },
  {
    id: 9, category: "policy",
    title: "国家网信办：生成式AI内容标注新规实施细则（征求意见稿）",
    url: "https://cac.gov.cn/example", domain: "cac.gov.cn",
    addedAt: "今天", coverColor: "#E03E2D", coverEmoji: "📋",
    aiInsight: "政策核心：强制标注+版权合规+未成年保护三项新规，直接影响内容平台合规成本，建议提前布局政策解读选题。截止征求意见日期：8月28日。",
    aiTags: ["政策资讯", "AI创作", "行业报告"],
  },
  {
    id: 10, category: "video", starred: true,
    title: "Everything is Fertile — 一位独立记者的全球采访方法论",
    url: "https://youtube.com/example", domain: "YouTube",
    addedAt: "4天前", coverColor: "#FF0000", coverEmoji: "🎥",
    aiInsight: "独立纪录片导演分享田野调查技巧，强调「无用信息即素材」的创作理念，对深度报道的素材收集方法有启发。",
    aiTags: ["深度报道", "创意参考", "案例参考"], readTime: "42分钟",
  },
  {
    id: 11, category: "product",
    title: "In Praise of Idleness, by Bertrand Russell — 全文及批注版",
    url: "https://example.com", domain: "gutenberg.org",
    addedAt: "8天前", coverColor: "#6B4423", coverEmoji: "📚",
    aiInsight: "罗素经典文章的全文批注版，探讨闲暇与创造力的关系，与当前「躺平文化」议题高度相关，可作为深度人文选题的思想来源。",
    aiTags: ["创意参考", "深度报道"],
  },
  {
    id: 12, category: "case",
    title: "这么看：我做错一件事，都是因为我发现了……少喝水",
    url: "https://example.com", domain: "zhihu.com",
    addedAt: "5天前", coverColor: "#0066FF", coverEmoji: "💡",
    aiInsight: "知乎高赞回答，从「少喝水→认知负荷下降」切入，用反直觉叙事结构引发共鸣，是内容创作中「钩子设计」的优秀案例。",
    aiTags: ["创意参考", "内容营销"],
  },
];

function InspireAssistantPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState("");

  const filtered = inspireItems.filter((item) => {
    const matchCat = activeCategory === "all" ? true
      : activeCategory === "starred" ? item.starred
      : item.category === activeCategory;
    const matchTag = activeTag === null || item.aiTags.includes(activeTag);
    const matchKw  = keyword === "" || item.title.toLowerCase().includes(keyword.toLowerCase()) || item.aiInsight.includes(keyword);
    return matchCat && matchTag && matchKw;
  });

  const glassHeader = {
    background: "linear-gradient(135deg, rgba(191,219,254,0.80) 0%, rgba(224,231,255,0.85) 100%)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(147,197,253,0.35)",
  };

  return (
    <div className="flex gap-4 h-full">

      {/* ── Left sub-nav ── */}
      <div className="w-44 flex-shrink-0 bg-white rounded-xl border border-border flex flex-col overflow-hidden">
        {/* Plugin download entry */}
        <div className="p-3 border-b border-border">
          <button className="w-full flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm">
            <Download size={13} /> 下载浏览器插件
          </button>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">安装插件，一键收藏网页内容到灵感库</p>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
          {INSPIRE_CATS.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === "all" ? inspireItems.length
              : cat.id === "starred" ? inspireItems.filter((i) => i.starred).length
              : inspireItems.filter((i) => i.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setActiveTag(null); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${isActive ? "bg-blue-50 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                <span className={isActive ? "text-primary" : ""}>{cat.icon}</span>
                <span className="flex-1 text-left">{cat.label}</span>
                <span className={`text-[10px] ${isActive ? "text-primary/70" : "text-muted-foreground"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Tags */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-1 mb-2">
            <Tag size={11} className="text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground">标签</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {INSPIRE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${activeTag === tag ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <div className="flex-1 flex items-center bg-white border border-border rounded-lg px-3 py-2 gap-2">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题、AI解读内容..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {keyword && <button onClick={() => setKeyword("")} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>}
          </div>
          {/* View mode */}
          <div className="flex items-center bg-white border border-border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}><Grid3x3 size={14} /></button>
            <button onClick={() => setViewMode("list")} className={`px-3 py-2 transition-colors ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}><List size={14} /></button>
          </div>
          {/* Add link */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-primary text-white text-xs px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus size={13} /> 添加链接
          </button>
        </div>

        {/* Result count */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{filtered.length} 条灵感内容</span>
          {activeTag && (
            <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              #{activeTag} <button onClick={() => setActiveTag(null)} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {viewMode === "grid" ? (
            <div style={{ columns: 3, columnGap: "12px" }} className="pb-4">
              {filtered.map((item) => (
                <div key={item.id} className="break-inside-avoid mb-3 bg-white border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all group">
                  {/* Body */}
                  <div className="p-3">
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <h3 className="flex-1 text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                      {item.starred && <Star size={12} className="text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />}
                    </div>
                    {/* AI Insight */}
                    <div className="bg-blue-50/70 rounded-lg px-2 py-1.5 mb-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Sparkles size={9} className="text-primary" />
                        <span className="text-[10px] font-semibold text-primary">AI解读</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{item.aiInsight}</p>
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.aiTags.map((t) => (
                        <button key={t} onClick={() => setActiveTag(t)} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">#{t}</button>
                      ))}
                    </div>
                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                        <Link size={9} className="flex-shrink-0" />
                        <span className="truncate">{item.domain}</span>
                        <span className="flex-shrink-0">· {item.addedAt}</span>
                      </div>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 flex-shrink-0 ml-1">
                        <ExternalLink size={9} /> 原文
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((item) => (
                <div key={item.id} className="bg-white border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group">
                  <div className="px-4 py-2.5 flex items-center gap-2" style={glassHeader}>
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: item.coverColor }}>{item.coverEmoji}</span>
                    <span className="text-xs font-medium text-blue-800/80 truncate flex-1">{item.domain}</span>
                    {item.starred && <Star size={12} className="text-yellow-400 flex-shrink-0" fill="currentColor" />}
                    <span className="text-[11px] text-blue-700/50 flex-shrink-0">{item.addedAt}</span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600/60 hover:text-blue-800 flex-shrink-0"><ExternalLink size={12} /></a>
                  </div>
                  <div className="px-4 py-2.5 flex gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors leading-snug line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.aiInsight}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[160px] content-start">
                      {item.aiTags.map((t) => (
                        <button key={t} onClick={() => setActiveTag(t)} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">#{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add link modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Plus size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">添加链接到灵感库</h3>
                <p className="text-xs text-muted-foreground">AI将自动读取内容并生成解读摘要</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="ml-auto text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <input
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="粘贴网页链接，例如 https://..."
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)} className="flex-1 border border-border text-muted-foreground text-sm py-2 rounded-lg hover:bg-muted transition-colors">取消</button>
              <button
                onClick={() => { setShowAddModal(false); setAddUrl(""); }}
                className="flex-1 bg-primary text-white text-sm py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} /> AI解读并保存
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Download size={12} />
              <span>也可</span>
              <button className="text-primary hover:underline font-medium">下载浏览器插件</button>
              <span>，在任意网页一键收藏</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hot Events Page ───────────────────────────────────────────────────────────

type HotEvent = {
  id: number;
  category: string;
  source: string;
  title: string;
  summary: string;
  location: string;
  date: string;
  heat?: string;
  officialArticleId?: number;
  relatedSources?: Array<{ name: string; title: string; type: string; url?: string }>;
};

const HOT_CATEGORIES = [
  { id: "all",      label: "全部",         color: "bg-gray-100 text-gray-600",        active: "bg-foreground text-white" },
  { id: "weibo",    label: "微博同城热搜",  color: "bg-red-50 text-red-600",           active: "bg-red-500 text-white" },
  { id: "douyin",   label: "抖音同城热搜",  color: "bg-gray-100 text-gray-700",        active: "bg-gray-800 text-white" },
  { id: "incident", label: "异动事件",      color: "bg-rose-50 text-rose-600",         active: "bg-rose-500 text-white" },
  { id: "policy",   label: "政策",          color: "bg-blue-50 text-blue-600",         active: "bg-blue-500 text-white" },
  { id: "livelihood", label: "民生",        color: "bg-orange-50 text-orange-600",     active: "bg-orange-500 text-white" },
  { id: "economy",  label: "经济",          color: "bg-amber-50 text-amber-700",       active: "bg-amber-500 text-white" },
  { id: "case",     label: "案件",          color: "bg-violet-50 text-violet-600",     active: "bg-violet-500 text-white" },
  { id: "tourism",  label: "文旅",          color: "bg-teal-50 text-teal-700",         active: "bg-teal-500 text-white" },
];

const CAT_META: Record<string, { bg: string; text: string; dot: string }> = {
  weibo:    { bg: "bg-red-100",    text: "text-red-600",    dot: "bg-red-500" },
  douyin:   { bg: "bg-gray-100",   text: "text-gray-700",   dot: "bg-gray-700" },
  incident: { bg: "bg-rose-100",   text: "text-rose-600",   dot: "bg-rose-500" },
  policy:   { bg: "bg-blue-100",   text: "text-blue-600",   dot: "bg-blue-500" },
  livelihood: { bg: "bg-orange-100", text: "text-orange-600", dot: "bg-orange-500" },
  economy:  { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500" },
  case:     { bg: "bg-violet-100", text: "text-violet-600", dot: "bg-violet-500" },
  tourism:  { bg: "bg-teal-100",   text: "text-teal-700",   dot: "bg-teal-500" },
};

const officialHotArticle = industryData.find((article) => article.id === 5)!;
const hotEventsData: HotEvent[] = [
  { id: 13, category: "policy", source: officialHotArticle.source, title: officialHotArticle.title,
    summary: officialHotArticle.summary, date: officialHotArticle.date, location: "全国", officialArticleId: officialHotArticle.id },
  { id: 1, category: "weibo", source: "微博同城热搜", title: "北京朝阳区突降暴雨，多处路段出现积水，相关部门连夜排水", summary: "受短时强降雨影响，朝阳区东三环、青年路等部分路段出现积水，早高峰通行受到影响。现场视频登上北京同城热搜，排水集团和属地街道已启动应急处置。", location: "北京·朝阳区", date: "2026-07-28", heat: "1240万", relatedSources: [
    { name: "微博同城热搜", title: "朝阳区多处路段积水", type: "社媒线索 · 示例" },
    { name: "本地媒体", title: "朝阳区启动应急排水", type: "媒体线索 · 示例" },
  ] },
  { id: 2, category: "economy", source: "经济", title: "中关村新一轮科技消费券上线，覆盖智能硬件与数字服务", summary: "海淀区启动新一轮科技消费促进活动，首批联合超过200家门店和线上平台，消费券覆盖AI终端、智能家居和数字内容服务，预计带动暑期消费超过5亿元。", location: "北京·海淀区", date: "2026-07-28" },
  { id: 3, category: "livelihood", source: "民生", title: "外卖骑手在东城区胡同发现老人晕倒，紧急施救并联系家属", summary: "一名外卖骑手送餐途中发现独居老人晕倒，立即拨打120并全程陪护。相关视频在本地平台传播后获得大量点赞，社区工作人员已上门完善老人日常照护信息。", location: "北京·东城区", date: "2026-07-27", heat: "830万" },
  { id: 4, category: "policy", source: "政策", title: "北京扩大「一刻钟便民生活圈」试点，年底前再覆盖120个社区", summary: "北京市商务局发布新一批试点名单，重点补充早餐、养老、托育、维修等社区服务业态，并鼓励连锁企业提供夜间服务，相关建设将在年底前完成。", location: "北京全市", date: "2026-07-28" },
  { id: 5, category: "tourism", source: "文旅", title: "北京中轴线夜游线路走红，钟鼓楼至前门客流量环比增长两倍", summary: "暑期以来，北京中轴线夜游持续升温，沿线博物馆延时开放，多个文化空间推出夜间展演。周末客流量较上月同期增长两倍，文旅部门已增加预约名额和志愿服务。", location: "北京·东城区", date: "2026-07-27", heat: "560万" },
  { id: 6, category: "incident", source: "异动事件", title: "西直门地铁站晚高峰客流短时激增，现场启动限流措施", summary: "受周边线路临时调整影响，西直门站换乘客流在半小时内快速增长，地铁运营方启动分批进站和临时引导措施。目前客流已恢复正常，未发生人员受伤。", location: "北京·西城区", date: "2026-07-28" },
  { id: 7, category: "douyin", source: "抖音同城热搜", title: "颐和园十七孔桥出现夏日「金光穿洞」，游客现场排队拍摄", summary: "傍晚阳光穿过十七孔桥形成连续光影，相关短视频迅速登上抖音北京同城榜。园方增派工作人员维持秩序，并提醒游客不要长时间占用观景通道。", location: "北京·海淀区", date: "2026-07-27", heat: "1050万" },
  { id: 8, category: "case", source: "案件", title: "北京警方通报网络售卖虚假演出票案件，涉案金额超过千万元", summary: "警方侦破一起利用社交平台发布虚假热门演出票信息的诈骗案件，抓获涉案人员12名。案件涉及全国多地消费者，相关资金追缴和退赔工作正在推进。", location: "北京·朝阳区", date: "2026-07-26" },
  { id: 9, category: "livelihood", source: "民生", title: "西城区老旧小区加装电梯启用「联合评审」，办理时间缩短一半", summary: "西城区将规划、住建、消防等部门的分散审批调整为联合评审，并为高龄居民提供代办服务。首批试点项目平均办理周期由6个月缩短至3个月。", location: "北京·西城区", date: "2026-07-25", heat: "420万" },
  { id: 10, category: "policy", source: "政策", title: "北京推出夜间共享停车新规，机关企事业单位车位可错时开放", summary: "北京市交通委发布共享停车实施指引，鼓励机关、写字楼和商业综合体向周边居民开放夜间闲置车位，首批试点覆盖朝阳、海淀、丰台等区域。", location: "北京全市", date: "2026-07-26" },
  { id: 11, category: "incident", source: "异动事件", title: "京藏高速进京方向发生多车追尾，晚高峰拥堵延伸约4公里", summary: "晚高峰期间，京藏高速清河收费站附近发生多车追尾，造成部分车道临时封闭。交管部门已完成现场处置，事故未造成人员重伤，路段通行逐步恢复。", location: "北京·昌平区", date: "2026-07-27" },
  { id: 12, category: "weibo", source: "微博同城热搜", title: "北京簋街多家餐厅推出小份菜菜单，网友点赞减少点餐浪费", summary: "簋街多家餐饮商户联合推出小份菜和半份菜，价格同步下调，并为剩余食品提供免费打包服务。相关话题登上北京同城热搜，不少网友表示愿意尝试。", location: "北京·东城区", date: "2026-07-26", heat: "510万" },
];

type SourceOption = {
  id: string;
  name: string;
  desc: string;
};

type HotEventSettings = {
  monitorDays?: number;
  notifyUsers?: string[];
  city: string;
  districts: string[];
  officialSites: string[];
  tipAccounts: string[];
  correspondents: string[];
  localSites: string[];
  localAccounts: string[];
  socialPlatform: string;
  socialAccounts: string[];
  keywordGroups: Record<string, string[]>;
  keywordFrequency?: Record<string, number>;
  anomalyRules: {
    metrics?: MetricSelection;
    enabled: boolean;
    growthRate: number;
    monitorDuration: string;
    minHeat: number;
    consecutiveHits: number;
  };
};

const HOT_EVENT_REGIONS: Record<string, string[]> = {
  北京市: ["全市", "东城区", "西城区", "朝阳区", "海淀区", "丰台区", "通州区", "昌平区"],
};

const OFFICIAL_SITES: Record<string, SourceOption[]> = {
  北京市: [
    { id: "bj-gov", name: "北京市人民政府", desc: "政策文件、政务动态" },
    { id: "bj-emergency", name: "北京市应急管理局", desc: "突发事件、预警信息" },
    { id: "bj-police", name: "平安北京", desc: "警情通报、民生提醒" },
    { id: "bj-transport", name: "北京市交通委员会", desc: "交通路况、出行政策" },
  ],
};

const OWN_SOURCE_GROUPS = {
  tipAccounts: [
    { id: "tip-1", name: "市民报料中心", desc: "热线、App及小程序报料" },
    { id: "tip-2", name: "新闻客户端报料", desc: "客户端用户线索" },
    { id: "tip-3", name: "24小时值班号", desc: "编辑部值班账号" },
  ],
  correspondents: [
    { id: "reporter-1", name: "李明 · 城市新闻", desc: "东城、西城片区记者" },
    { id: "reporter-2", name: "陈晓 · 民生调查", desc: "朝阳、海淀片区记者" },
    { id: "reporter-3", name: "王雪 · 区街通讯员", desc: "丰台、通州片区通讯员" },
  ],
};

const LOCAL_MEDIA: Record<string, { sites: SourceOption[]; accounts: SourceOption[] }> = {
  北京市: {
    sites: [
      { id: "beijing-daily", name: "北京日报客户端", desc: "北京权威新闻资讯" },
      { id: "qianlong", name: "千龙网", desc: "北京本地综合新闻站点" },
      { id: "beijing-evening", name: "北京晚报", desc: "城市民生资讯" },
    ],
    accounts: [
      { id: "beijing-time", name: "@北京时间", desc: "北京广电新闻账号" },
      { id: "beijing-daily-account", name: "@北京日报", desc: "北京日报融媒账号" },
      { id: "brtv-news", name: "@BRTV新闻", desc: "北京广播电视台新闻账号" },
    ],
  },
};

const SOCIAL_SOURCES: Record<string, SourceOption[]> = {
  weibo: [
    { id: "wb-local", name: "微博同城", desc: "同城热搜与突发榜单" },
    { id: "wb-headline", name: "@头条新闻", desc: "社会热点聚合账号" },
    { id: "wb-video", name: "@梨视频", desc: "现场短视频与城市线索" },
  ],
  douyin: [
    { id: "dy-local", name: "抖音同城", desc: "本地热视频与地点榜" },
    { id: "dy-news", name: "@抖音热点", desc: "平台热点聚合账号" },
    { id: "dy-citizen", name: "@市民现场", desc: "用户拍客与现场线索" },
  ],
  xiaohongshu: [
    { id: "xhs-local", name: "小红书同城", desc: "城市生活与消费趋势" },
    { id: "xhs-city", name: "城市生活薯", desc: "城市体验热门账号" },
  ],
  kuaishou: [
    { id: "ks-local", name: "快手同城", desc: "本地直播与热视频" },
    { id: "ks-news", name: "@快手新闻", desc: "平台新闻热点账号" },
  ],
};

const HOT_EVENT_KEYWORD_CATEGORIES = [
  { id: "policy", label: "政策", desc: "政策发布、政务动态及惠民措施", color: "bg-blue-100 text-blue-600" },
  { id: "livelihood", label: "民生", desc: "公共服务、社区治理及民生线索", color: "bg-orange-100 text-orange-600" },
  { id: "economy", label: "经济", desc: "消费市场、企业经营及产业动态", color: "bg-amber-100 text-amber-700" },
  { id: "case", label: "案件", desc: "警情通报、执法行动及司法案件", color: "bg-violet-100 text-violet-600" },
  { id: "tourism", label: "文旅", desc: "文体活动、旅游热点及城市风貌", color: "bg-teal-100 text-teal-700" },
];

const DEFAULT_HOT_EVENT_SETTINGS: HotEventSettings = {
  city: "北京市",
  districts: ["全市"],
  officialSites: ["bj-gov", "bj-emergency"],
  tipAccounts: ["tip-1"],
  correspondents: ["reporter-1", "reporter-2"],
  localSites: ["beijing-daily", "qianlong"],
  localAccounts: ["beijing-time"],
  socialPlatform: "weibo",
  socialAccounts: ["wb-local", "dy-local"],
  keywordGroups: {
    policy: ["政策发布", "惠民政策", "政务改革"],
    livelihood: ["物业服务", "消费维权", "公共服务"],
    economy: ["企业经营", "消费市场", "产业动态"],
    case: ["警情通报", "执法行动", "案件调查"],
    tourism: ["文体活动", "旅游热点", "城市景观"],
  },
  anomalyRules: {
    enabled: true,
    growthRate: 50,
    monitorDuration: "30",
    minHeat: 10000,
    consecutiveHits: 2,
  },
};

function HotEventSettingsModal({
  initialSettings,
  onClose,
  onSave,
}: {
  initialSettings: HotEventSettings;
  onClose: () => void;
  onSave: (settings: HotEventSettings, asBasePackage?: boolean) => void;
}) {
  const [draft, setDraft] = useState<HotEventSettings>(() => ({
    ...initialSettings,
    districts: [...initialSettings.districts],
    officialSites: [...initialSettings.officialSites],
    tipAccounts: [...initialSettings.tipAccounts],
    correspondents: [...initialSettings.correspondents],
    localSites: [...initialSettings.localSites],
    localAccounts: [...initialSettings.localAccounts],
    socialAccounts: [...initialSettings.socialAccounts],
    keywordFrequency: { ...initialSettings.keywordFrequency },
    keywordGroups: Object.fromEntries(
      Object.entries(initialSettings.keywordGroups).map(([category, keywords]) => [category, [...keywords]])
    ),
    anomalyRules: { ...initialSettings.anomalyRules, metrics: normalizeMetricSelection(initialSettings.anomalyRules.metrics ?? defaultMetricSelection) },
  }));
  const [activeSection, setActiveSection] = useState("region");
  const [localMediaType, setLocalMediaType] = useState<"sites" | "accounts">("sites");
  const [keywordInputs, setKeywordInputs] = useState<Record<string, string>>({});
  const [sourceSearches, setSourceSearches] = useState<Record<string, string>>({});

  const toggleValue = (key: keyof HotEventSettings, id: string) => {
    setDraft((current) => {
      const values = current[key] as string[];
      return { ...current, [key]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id] };
    });
  };

  const changeCity = (city: string) => {
    const official = OFFICIAL_SITES[city] ?? [];
    const local = LOCAL_MEDIA[city] ?? { sites: [], accounts: [] };
    setDraft((current) => ({
      ...current,
      city,
      districts: ["全市"],
      officialSites: official.slice(0, 2).map((item) => item.id),
      localSites: local.sites.slice(0, 1).map((item) => item.id),
      localAccounts: local.accounts.slice(0, 1).map((item) => item.id),
    }));
  };

  const addKeyword = (category: string) => {
    const keyword = (keywordInputs[category] ?? "").trim();
    if (!keyword) return;
    setDraft((current) => {
      const keywords = current.keywordGroups[category] ?? [];
      if (keywords.includes(keyword)) return current;
      return {
        ...current,
        keywordGroups: { ...current.keywordGroups, [category]: [...keywords, keyword] },
      };
    });
    setKeywordInputs((current) => ({ ...current, [category]: "" }));
  };

  const removeKeyword = (category: string, keyword: string) => {
    setDraft((current) => ({
      ...current,
      keywordGroups: {
        ...current.keywordGroups,
        [category]: (current.keywordGroups[category] ?? []).filter((item) => item !== keyword),
      },
    }));
  };

  const keywordTotal = Object.values(draft.keywordGroups).reduce((total, keywords) => total + keywords.length, 0);

  const sections = [
    { id: "region", label: "基础设置", icon: <MapPin size={15} />, count: draft.districts.length },
    { id: "official", label: "官方发布源", icon: <ShieldCheck size={15} />, count: draft.officialSites.length },
    { id: "own", label: "自有报料", icon: <UserRound size={15} />, count: draft.tipAccounts.length + draft.correspondents.length },
    { id: "local", label: "本地媒体", icon: <Building2 size={15} />, count: draft.localSites.length + draft.localAccounts.length },
    { id: "social", label: "社交媒体", icon: <Radio size={15} />, count: draft.socialAccounts.length },
    { id: "keywords", label: "关键词", icon: <Hash size={15} />, count: keywordTotal },
    { id: "anomaly", label: "异动事件", icon: <TrendingUp size={15} />, count: draft.anomalyRules.enabled ? 1 : 0 },
  ];

  const SourceList = ({
    items,
    settingKey,
    searchKey,
    searchPlaceholder,
    listTitle,
  }: {
    items: SourceOption[];
    settingKey: keyof HotEventSettings;
    searchKey: string;
    searchPlaceholder: string;
    listTitle: string;
  }) => {
    const selected = draft[settingKey] as string[];
    const searchQuery = sourceSearches[searchKey] ?? "";
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchResults = items.filter((item) =>
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.desc.toLowerCase().includes(normalizedQuery)
    );
    return (
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="text-xs font-medium text-foreground">{listTitle}</p>
          <div className="relative w-56 z-20">
            <div className="flex items-stretch bg-white border border-border rounded-lg overflow-hidden focus-within:border-primary transition-colors">
              <input
                value={searchQuery}
                onChange={(e) => setSourceSearches((current) => ({ ...current, [searchKey]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSourceSearches((current) => ({ ...current, [searchKey]: "" }));
                  }
                }}
                placeholder={searchPlaceholder}
                className="flex-1 min-w-0 bg-transparent outline-none text-xs px-3 py-1.5 placeholder:text-muted-foreground"
              />
              <button className="bg-primary text-white text-xs px-3.5 hover:bg-primary/90 transition-colors flex-shrink-0">
                搜索
              </button>
            </div>
            {normalizedQuery !== "" && (
              <div className="absolute top-full right-0 mt-1.5 w-80 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border text-[11px] text-muted-foreground">
                  搜索结果 · {searchResults.length}
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {searchResults.length > 0 ? searchResults.map((item) => {
                    const subscribed = selected.includes(item.id);
                    return (
                      <div key={item.id} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/70 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          {settingKey === "officialSites" || settingKey === "localSites"
                            ? <Globe size={14} />
                            : <UserRound size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (!subscribed) toggleValue(settingKey, item.id);
                          }}
                          disabled={subscribed}
                          className={`text-[11px] px-2.5 py-1 rounded-md flex-shrink-0 transition-all ${
                            subscribed
                              ? "text-muted-foreground bg-muted opacity-0 group-hover:opacity-100"
                              : "text-primary bg-primary/10 hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {subscribed ? "已订阅" : "添加订阅"}
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Search size={18} className="opacity-30 mb-2" />
                      <p className="text-xs">未找到匹配的账号或网站</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleValue(settingKey, item.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  checked ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/30"
                }`}
              >
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                  checked ? "bg-primary border-primary text-white" : "border-border text-transparent"
                }`}>
                  <Check size={12} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">{item.name}</span>
                  <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{item.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[760px] max-h-[92vh] mx-4 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">潜在热点设置</h2>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-48 flex-shrink-0 bg-muted/50 border-r border-border p-3 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                  activeSection === section.id ? "bg-white text-primary font-medium shadow-sm" : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                }`}
              >
                {section.icon}
                <span className="flex-1">{section.label}</span>
                <span className={`text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center ${
                  section.count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>{section.count}</span>
                <ChevronRight size={12} className="opacity-40" />
              </button>
            ))}
          </div>

          <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
            {activeSection === "region" && (
              <div>
                  <div className="mb-6 space-y-4">
                    <label className="block text-xs font-medium">监测时效
                      <select value={draft.monitorDays ?? 1} onChange={(event) => setDraft((current) => ({ ...current, monitorDays: Number(event.target.value) }))}
                        className="mt-2 block w-full rounded-lg border border-border bg-white p-2">
                        {[1, 3, 7].map((days) => <option key={days} value={days}>{days}天</option>)}
                      </select>
                    </label>

                  </div>
                <div className="mb-5">
                  <label className="block text-xs font-medium text-foreground mb-2">省份 / 城市</label>
                  <div className="flex gap-2">
                    <div className="w-36 bg-muted text-muted-foreground text-sm px-3 py-2.5 rounded-lg">北京市</div>
                    <select
                      value={draft.city}
                      onChange={(e) => changeCity(e.target.value)}
                      className="flex-1 bg-white border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {Object.keys(HOT_EVENT_REGIONS).map((city) => <option key={city}>{city}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">监测区县</label>
                  <div className="flex flex-wrap gap-2">
                    {HOT_EVENT_REGIONS[draft.city].map((district) => {
                      const checked = draft.districts.includes(district);
                      return (
                        <button
                          key={district}
                          onClick={() => {
                            if (district === "全市") {
                              setDraft((current) => ({ ...current, districts: ["全市"] }));
                            } else {
                              setDraft((current) => {
                                const next = current.districts.filter((item) => item !== "全市");
                                return { ...current, districts: next.includes(district) ? next.filter((item) => item !== district) : [...next, district] };
                              });
                            }
                          }}
                          className={`px-4 py-2 rounded-full text-sm border transition-all ${
                            checked ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                          }`}
                        >
                          {checked && <Check size={12} className="inline mr-1" />}{district}
                        </button>
                      );
                    })}
                  </div>
                  <AlertRecipientPicker selected={draft.notifyUsers ?? []} onChange={(notifyUsers) => setDraft((current) => ({ ...current, notifyUsers }))} />
                </div>
              </div>
            )}

            {activeSection === "official" && (
              <div>
                <SourceList
                  items={OFFICIAL_SITES[draft.city] ?? []}
                  settingKey="officialSites"
                  searchKey={`official-${draft.city}`}
                  searchPlaceholder="请输入网站名称"
                  listTitle="官方网站"
                />
              </div>
            )}

            {activeSection === "own" && (
              <div>
                <div className="mb-6">
                  <SourceList
                    items={OWN_SOURCE_GROUPS.tipAccounts}
                    settingKey="tipAccounts"
                    searchKey="own-tip-accounts"
                    searchPlaceholder="请输入报料账号"
                    listTitle="报料账号"
                  />
                </div>
                <div>
                  <SourceList
                    items={OWN_SOURCE_GROUPS.correspondents}
                    settingKey="correspondents"
                    searchKey="own-correspondents"
                    searchPlaceholder="请输入记者或通讯员"
                    listTitle="记者 / 通讯员"
                  />
                </div>
              </div>
            )}

            {activeSection === "local" && (
              <div>
                <div className="inline-flex bg-muted rounded-lg p-1 mb-4">
                  {([{ id: "sites", label: "网站站点" }, { id: "accounts", label: "媒体账号" }] as const).map((tab) => (
                    <button key={tab.id} onClick={() => setLocalMediaType(tab.id)}
                      className={`px-4 py-1.5 rounded-md text-xs transition-all ${localMediaType === tab.id ? "bg-white text-primary shadow-sm font-medium" : "text-muted-foreground"}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {localMediaType === "sites"
                  ? <SourceList
                      items={LOCAL_MEDIA[draft.city]?.sites ?? []}
                      settingKey="localSites"
                      searchKey={`local-sites-${draft.city}`}
                      searchPlaceholder="请输入网站名称"
                      listTitle="网站站点"
                    />
                  : <SourceList
                      items={LOCAL_MEDIA[draft.city]?.accounts ?? []}
                      settingKey="localAccounts"
                      searchKey={`local-accounts-${draft.city}`}
                      searchPlaceholder="请输入媒体账号"
                      listTitle="媒体账号"
                    />}
              </div>
            )}

            {activeSection === "social" && (
              <div>
                <div className="flex gap-2 mb-4 border-b border-border">
                  {[
                    { id: "weibo", label: "微博" }, { id: "douyin", label: "抖音" },
                    { id: "xiaohongshu", label: "小红书" }, { id: "kuaishou", label: "快手" },
                  ].map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => setDraft((current) => ({ ...current, socialPlatform: platform.id }))}
                      className={`relative px-3 py-2.5 text-sm ${draft.socialPlatform === platform.id ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {platform.label}
                      {draft.socialPlatform === platform.id && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
                    </button>
                  ))}
                </div>
                <SourceList
                  items={SOCIAL_SOURCES[draft.socialPlatform] ?? []}
                  settingKey="socialAccounts"
                  searchKey={`social-${draft.socialPlatform}`}
                  searchPlaceholder="请输入账号名称"
                  listTitle={`${[
                    { id: "weibo", label: "微博" },
                    { id: "douyin", label: "抖音" },
                    { id: "xiaohongshu", label: "小红书" },
                    { id: "kuaishou", label: "快手" },
                  ].find((item) => item.id === draft.socialPlatform)?.label ?? ""}账号`}
                />
              </div>
            )}

            {activeSection === "keywords" && (
              <div>
                <div className="space-y-3">
                  {HOT_EVENT_KEYWORD_CATEGORIES.map((category) => {
                    const keywords = draft.keywordGroups[category.id] ?? [];
                    return (
                      <div key={category.id} className="border border-border rounded-xl p-4 bg-white">
                        <div className="flex items-start gap-3 mb-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${category.color}`}>
                            {category.label}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{category.desc}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">已添加 {keywords.length} 个关键词</p>
                          </div>
                          <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground" title="该类关键词在单篇内容中累计出现的最低次数">
                            出现频次 ≥
                            <input type="number" min={1} step={1} aria-label={category.label + "关键词出现频次"}
                              value={draft.keywordFrequency?.[category.id] ?? 1}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isSafeInteger(value) || value < 1) return;
                                setDraft((current) => ({ ...current, keywordFrequency: { ...current.keywordFrequency, [category.id]: value } }));
                              }}
                              className="w-16 rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary" />
                            次
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3 min-h-7">
                          {keywords.length > 0 ? keywords.map((keyword) => (
                            <span key={keyword} className="inline-flex items-center gap-1.5 bg-primary/5 text-primary border border-primary/10 text-xs px-2.5 py-1 rounded-full">
                              {keyword}
                              <button
                                onClick={() => removeKeyword(category.id, keyword)}
                                className="text-primary/50 hover:text-primary transition-colors"
                                aria-label={`删除关键词${keyword}`}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          )) : (
                            <span className="text-xs text-muted-foreground/60">暂未添加关键词</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center bg-muted rounded-lg px-3 py-2 gap-2">
                            <Hash size={12} className="text-muted-foreground flex-shrink-0" />
                            <input
                              value={keywordInputs[category.id] ?? ""}
                              onChange={(e) => setKeywordInputs((current) => ({ ...current, [category.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addKeyword(category.id);
                                }
                              }}
                              placeholder={`添加${category.label}关键词`}
                              className="flex-1 min-w-0 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                            />
                          </div>
                          <button
                            onClick={() => addKeyword(category.id)}
                            disabled={!(keywordInputs[category.id] ?? "").trim()}
                            className="flex items-center gap-1 text-xs text-primary border border-primary/20 px-3 py-2 rounded-lg hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus size={12} /> 添加
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === "anomaly" && (
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-xs font-medium text-foreground">启用异动监测</span>
                  <button
                    onClick={() => setDraft((current) => ({
                      ...current,
                      anomalyRules: { ...current.anomalyRules, enabled: !current.anomalyRules.enabled },
                    }))}
                    className={`ml-auto w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${
                      draft.anomalyRules.enabled ? "bg-primary" : "bg-switch-background"
                    }`}
                    aria-label={draft.anomalyRules.enabled ? "关闭异动监测" : "开启异动监测"}
                  >
                    <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      draft.anomalyRules.enabled ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                <div className={`space-y-4 transition-opacity ${draft.anomalyRules.enabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                  <AnomalyMetrics value={draft.anomalyRules.metrics ?? defaultMetricSelection}
                    onChange={(metrics) => setDraft((current) => ({ ...current, anomalyRules: { ...current.anomalyRules, metrics } }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-border rounded-xl p-4">
                      <label className="block text-xs font-medium text-foreground mb-1">指标增长阈值</label>
                      <p className="text-[11px] text-muted-foreground mb-3">所选指标在监测时长内增长达到该比例时触发</p>
                      <div className="flex items-center bg-muted rounded-lg overflow-hidden">
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={draft.anomalyRules.growthRate}
                          onChange={(e) => setDraft((current) => ({
                            ...current,
                            anomalyRules: { ...current.anomalyRules, growthRate: Math.max(1, Number(e.target.value)) },
                          }))}
                          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold px-3 py-2.5"
                        />
                        <span className="text-sm text-muted-foreground pr-3">%</span>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <label className="block text-xs font-medium text-foreground mb-1">监测时长</label>
                      <p className="text-[11px] text-muted-foreground mb-3">计算热度增长率所使用的时间窗口</p>
                      <select
                        value={draft.anomalyRules.monitorDuration}
                        onChange={(e) => setDraft((current) => ({
                          ...current,
                          anomalyRules: { ...current.anomalyRules, monitorDuration: e.target.value },
                        }))}
                        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="15">15 分钟</option>
                        <option value="30">30 分钟</option>
                        <option value="60">1 小时</option>
                        <option value="180">3 小时</option>
                        <option value="360">6 小时</option>
                        <option value="1440">24 小时</option>
                      </select>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <label className="block text-xs font-medium text-foreground mb-1">最低指标值门槛</label>
                      <p className="text-[11px] text-muted-foreground mb-3">每项所选指标独立应用该门槛，减少偶发波动干扰</p>
                      <select
                        value={draft.anomalyRules.minHeat}
                        onChange={(e) => setDraft((current) => ({
                          ...current,
                          anomalyRules: { ...current.anomalyRules, minHeat: Number(e.target.value) },
                        }))}
                        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value={1000}>1,000</option>
                        <option value={5000}>5,000</option>
                        <option value={10000}>10,000</option>
                        <option value={50000}>50,000</option>
                        <option value={100000}>100,000</option>
                      </select>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <label className="block text-xs font-medium text-foreground mb-1">连续触发次数</label>
                      <p className="text-[11px] text-muted-foreground mb-3">连续达到阈值后才标记为异动事件</p>
                      <div className="flex items-center bg-muted rounded-lg p-1">
                        {[1, 2, 3].map((count) => (
                          <button
                            key={count}
                            onClick={() => setDraft((current) => ({
                              ...current,
                              anomalyRules: { ...current.anomalyRules, consecutiveHits: count },
                            }))}
                            className={`flex-1 py-1.5 rounded-md text-xs transition-all ${
                              draft.anomalyRules.consecutiveHits === count
                                ? "bg-white text-primary shadow-sm font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {count} 次
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Zap size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">当前捕捉规则</p>
                      <p className="mt-2 text-xs leading-5 text-primary">{metricSummary(draft.anomalyRules.metrics ?? defaultMetricSelection) || "未选择监测指标"}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        任一所选指标在 {Number(draft.anomalyRules.monitorDuration) >= 60
                          ? `${Number(draft.anomalyRules.monitorDuration) / 60} 小时`
                          : `${draft.anomalyRules.monitorDuration} 分钟`}内增长不低于
                        <span className="text-primary font-semibold"> {draft.anomalyRules.growthRate}%</span>，
                        指标值达到 <span className="text-primary font-semibold">{draft.anomalyRules.minHeat.toLocaleString()}</span>，
                        并连续触发 {draft.anomalyRules.consecutiveHits} 次时，自动标记为异动事件。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <button onClick={onClose} className="ml-auto text-sm text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted">取消</button>
          <button onClick={() => onSave(draft, true)} className="text-sm text-primary bg-white border border-primary/25 px-4 py-2 rounded-lg hover:bg-primary/5 hover:border-primary/40 font-medium transition-colors">
            保存并设为基础数据包
          </button>
          <button onClick={() => onSave(draft)} className="text-sm bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary/90 font-medium shadow-sm">
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

type ArticleDetail = {
  id: string;
  category: string;
  source: string;
  title: string;
  publishedAt: string;
  summary: string;
  keywords: string[];
  context?: string;
  summarySource?: ArticleSummarySource;
  summaryMode?: ArticleSummaryMode;
  metadata?: Array<[string, string]>;
  event?: {
    reason: string;
    official: boolean;
    sources: NonNullable<HotEvent["relatedSources"]>;
  };
};

function ArticleDetailDrawer({
  article,
  onClose,
  showAiSummary = false,
  verification,
  onSearch,
}: {
  article: ArticleDetail;
  showAiSummary?: boolean;
  onSearch?: (query: string) => void;
  verification?: { verified: boolean; onVerify?: () => void };
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const comments = [
    { name: "林晓", role: "责任编辑", time: "12分钟前", text: "这条内容的信息密度不错，建议继续核实关键数据和现场信源。" },
    { name: "周宁", role: "选题编辑", time: "8分钟前", text: `可以围绕“${article.keywords[0] ?? article.category}”补充采访对象，形成差异化报道角度。` },
  ];
  const frequentQuestions = [
    { label: "事件目前有哪些最新进展？", ratio: 36 },
    { label: "报道信息来源是否真实可靠？", ratio: 28 },
    { label: `${article.keywords[0] ?? article.category}将带来哪些影响？`, ratio: 19 },
  ];
  const attitudes = [
    { label: "正向", value: 48, color: "bg-green-500", text: "text-green-600" },
    { label: "中性", value: 32, color: "bg-blue-400", text: "text-blue-600" },
    { label: "负向", value: 20, color: "bg-rose-400", text: "text-rose-600" },
  ];
  const hideCommentAnalysis =
    article.category === "热门事件" ||
    article.category === "热搜" ||
    article.category.includes("同城热搜");
  const drawerActions = actionButtons;

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/35 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute inset-y-0 right-0 w-[86vw] max-w-6xl bg-white shadow-xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-14 px-5 border-b border-border flex items-center gap-3 flex-shrink-0 bg-white">
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="关闭稿件详情"
          >
            <X size={16} />
          </button>
          <div>
            <p className="text-sm font-semibold text-foreground">{article.event ? "事件详情" : "稿件详情"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{article.category}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {drawerActions.map((button) => {
              const showsWorkflowFeedback = showAiSummary && button.id !== "ai" &&
                (article.summaryMode !== "competitor" || button.id !== "video");
              const disabled = showAiSummary && button.id !== "ai" && !showsWorkflowFeedback;
              return <button
                key={button.id}
                onClick={button.id === "ai" && onSearch ? () => onSearch(article.title)
                  : showsWorkflowFeedback ? () => toast.info(`${button.label}流程暂未接入本地原型。`) : undefined}
                disabled={disabled}
                title={disabled ? "业务入口暂未接入" : undefined}
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  button.id === "report" || button.id === "create"
                    ? "bg-primary text-white border border-primary hover:bg-primary/90"
                    : "text-primary bg-white border border-primary/25 hover:bg-primary/5 hover:border-primary/50"
                }`}
              >
                {button.icon}{button.label}
              </button>;
            })}
          </div>
        </div>

        <div className={showAiSummary ? "flex-1 min-h-0 overflow-y-auto md:flex md:overflow-hidden" : "flex-1 min-h-0 flex"}>
          <div className="flex-1 min-w-0 overflow-y-auto px-7 py-6 scrollbar-hide bg-white">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-medium text-primary bg-primary/5 px-2 py-1 rounded">{article.category}</span>
                <span className="text-xs text-muted-foreground">{article.source}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{article.publishedAt}</span>
              </div>

              <h2 className="text-lg font-semibold text-foreground leading-relaxed mb-5">{article.title}</h2>

              <div className="bg-muted/70 border-l-2 border-primary p-4 mb-7">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-2.5">
                  内容摘要
                </div>
                <p className="text-sm text-foreground/80 leading-7">{article.summary}</p>
              </div>

              {article.event && <section className="mb-7 space-y-4 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">入池与核实</h3>
                  <span className={verification?.verified ? "rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700" : "rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700"}>{verification?.verified ? "已核实" : "待核实"}</span>
                  {article.event.official && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">已有官方通报</span>}
                  {verification?.onVerify && !verification.verified && <button onClick={verification.onVerify} className="ml-auto rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">标记为已核实</button>}
                </div>
                <p className="text-xs text-muted-foreground">入池原因 · {article.event.reason}</p>
              </section>}
              {article.metadata && <dl className="mb-7 flex flex-wrap gap-4 rounded-xl border border-border bg-muted/30 p-4 text-xs">
                {article.metadata.map(([name, value]) => <div key={name}><dt className="text-muted-foreground">{name}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
              </dl>}
              <div className="mb-7">
                <div className="bg-muted/40 border border-border/70 rounded-lg p-5">
                  <p className="text-sm text-foreground/80 leading-7">{article.summary}</p>
                  <p className="text-sm text-foreground/80 leading-7 mt-3">
                    {article.context ?? `该稿件由系统从“${article.source}”抓取并完成内容解析。当前信息已进入潜在线索池，编辑可结合来源可信度、传播趋势与受众关注点进行进一步核实和策划。`}
                  </p>
                </div>
              </div>

              {!hideCommentAnalysis && <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">评论</h3>
                  <span className="text-[11px] text-muted-foreground">{comments.length} 条</span>
                </div>
                <div className="border-y border-border overflow-hidden">
                  {comments.map((comment, index) => (
                    <div key={comment.name} className={`flex items-start gap-3 px-1 py-4 ${index > 0 ? "border-t border-border" : ""}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-primary/10 text-primary">
                        {comment.name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{comment.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{comment.time}</span>
                        </div>
                        <p className="text-xs text-foreground/75 leading-relaxed mt-1.5">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}
            </div>
          </div>

          <div className={showAiSummary ? "bg-white border-border border-t p-6 md:w-[360px] md:shrink-0 md:border-t-0 md:border-l md:overflow-y-auto" : "w-[360px] flex-shrink-0 border-l border-border bg-white overflow-y-auto p-6 scrollbar-hide"}>
            <div className="bg-white">
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">来源</p>
                  <p className="text-sm text-foreground font-medium">{article.source}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">标题</p>
                  <p className="text-sm text-foreground leading-relaxed">{article.title}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">报道时间</p>
                  <p className="text-sm text-foreground">{article.publishedAt}</p>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-[11px] text-violet-600 font-semibold mb-2 flex items-center gap-1">
                    <Sparkles size={11} /> AI 报道简介
                  </p>
                  <p className="text-xs text-foreground/75 leading-6">{article.summary}</p>
                </div>
                <div>
                  <p className="text-[11px] text-violet-600 font-semibold mb-2 flex items-center gap-1">
                    <Tag size={11} /> AI 报道关键词
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {article.keywords.map((keyword) => (
                      <span key={keyword} className="text-[11px] text-primary bg-primary/5 px-2 py-1 rounded">{keyword}</span>
                    ))}
                  </div>
                </div>
                <ArticleTopics key={article.id} title={article.title} articleId={article.summarySource?.articleId} />
                {showAiSummary && <ArticleSummarySection key={article.id} mode={article.summaryMode ?? "industry"} source={article.summarySource} />}
                {!hideCommentAnalysis && <div className="pt-5 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                      <MessageSquare size={13} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">AI 评论分析</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">已分析全部 {comments.length} 条评论</p>
                    </div>
                    <span className="ml-auto text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">AI生成</span>
                  </div>

                  <div className="mb-5">
                    <p className="text-[11px] font-medium text-foreground mb-2.5">用户高频问题</p>
                    <div className="space-y-2.5">
                      {frequentQuestions.map((question, index) => (
                        <div key={question.label}>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">{index + 1}</span>
                            <span className="text-[11px] text-foreground/80 leading-relaxed flex-1">{question.label}</span>
                            <span className="text-[10px] text-muted-foreground">{question.ratio}%</span>
                          </div>
                          <div className="ml-6 mt-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${question.ratio}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium text-foreground mb-2.5">评论态度分布</p>
                    <div className="h-2 flex rounded-full overflow-hidden bg-muted mb-3">
                      {attitudes.map((attitude) => (
                        <div key={attitude.label} className={attitude.color} style={{ width: `${attitude.value}%` }} />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {attitudes.map((attitude) => (
                        <div key={attitude.label} className="text-center">
                          <div className={`text-sm font-semibold ${attitude.text}`}>{attitude.value}%</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{attitude.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>}
                {!article.summarySource && <button className="w-full flex items-center justify-center gap-1.5 text-xs text-primary border border-primary/25 rounded py-2 hover:bg-primary/5">
                  <ExternalLink size={12} /> 查看来源原文
                </button>}
                {(article.event || article.id.startsWith("hot-")) && <HotspotLevel story={article} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visiblePages: Array<number | "ellipsis"> =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : page <= 4
        ? [1, 2, 3, 4, 5, "ellipsis", totalPages]
        : page >= totalPages - 3
          ? [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
          : [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];

  return (
    <div className="flex-shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-border bg-background">
      <span className="text-xs text-muted-foreground mr-2">共 {total} 条</span>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 disabled:opacity-30 disabled:pointer-events-none"
        aria-label="上一页"
      >
        <ChevronLeft size={16} />
      </button>
      {visiblePages.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-muted-foreground">•••</span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            className={`w-8 h-8 rounded-lg text-sm transition-all ${
              page === item
                ? "border border-primary text-primary bg-white shadow-sm"
                : "text-foreground hover:text-primary hover:bg-primary/5"
            }`}
          >
            {item}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground hover:text-primary hover:bg-primary/5 disabled:opacity-30 disabled:pointer-events-none"
        aria-label="下一页"
      >
        <ChevronRight size={16} />
      </button>
      <select
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className="ml-3 h-8 bg-white border border-border rounded-lg px-3 text-xs text-muted-foreground outline-none focus:border-primary"
      >
        <option value={10}>10 条/页</option>
        <option value={20}>20 条/页</option>
        <option value={50}>50 条/页</option>
      </select>
    </div>
  );
}

function HotEventsPage({ onSearch }: { onSearch: (query: string) => void }) {
  // The standalone preview represents an editor with verification permission.
  const canVerify = import.meta.env.VITE_PREVIEW_CAN_VERIFY !== "false";
  const [verified, setVerified] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("hot-event-verification") ?? "[]");
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  });
  const verifyEvent = (id: string) => {
    const next = [...new Set([...verified, id])];
    setVerified(next);
    localStorage.setItem("hot-event-verification", JSON.stringify(next));
  };
  const [activeCategory, setActiveCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings, settingsFeedback] = usePreviewSettings("hot-sources", DEFAULT_HOT_EVENT_SETTINGS);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const dateOptions = [
    { id: "all", label: "全部日期" },
    { id: "today", label: "今日" },
    { id: "yesterday", label: "昨日" },
    { id: "3days", label: "近3天" },
  ];

  const today = newsroomDaysBefore(0);
  const filtered = hotEventsData.filter((event) => {
    const matchCat = activeCategory === "all" || event.category === activeCategory;
    const matchKeyword = [event.title, event.summary, event.location].some((value) => value.includes(keyword.trim()));
    return matchCat && matchKeyword && dateMatches(event.date, dateFilter, today);
  });
  const paginatedEvents = filtered.slice((page - 1) * pageSize, page * pageSize);

  const catLabel = (id: string) => HOT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
  const catMeta  = (id: string) => CAT_META[id] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };

  return (
    <div className="flex flex-col h-full">
      {settingsFeedback && <p role="status" className="mb-2 text-xs text-muted-foreground">{settingsFeedback}</p>}
      {showSettings && (
        <HotEventSettingsModal
          initialSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(nextSettings, asBasePackage) => {
            setSettings(nextSettings, asBasePackage);
            setPage(1);
            setShowSettings(false);
          }}
        />
      )}
      {selectedArticle && <ArticleDetailDrawer showAiSummary onSearch={onSearch} article={selectedArticle} onClose={() => setSelectedArticle(null)}
        verification={{ verified: verified.includes(selectedArticle.id), onVerify: canVerify ? () => verifyEvent(selectedArticle.id) : undefined }} />}
      {/* ── Filters bar ── */}
      <div className="flex-shrink-0 space-y-3 mb-4">
        <div className="flex items-center">
          <h2 className="text-base font-semibold text-foreground">潜在热点事件</h2>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto flex items-center gap-1.5 text-xs bg-white border border-border text-foreground px-3.5 py-2 rounded-lg hover:border-primary/40 hover:text-primary transition-all shadow-sm"
          >
            <Settings size={13} /> 数据源设置
          </button>
        </div>

        {/* Category + keyword + date */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {HOT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setPage(1); }}
                className={`text-xs px-3.5 py-2 rounded-lg border font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="w-56 flex-shrink-0 flex items-center bg-card border border-border rounded-lg px-3 py-2 gap-2">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="搜索标题、地点、关键词..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {keyword && (
              <button onClick={() => { setKeyword(""); setPage(1); }} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
            {dateOptions.map((d) => (
              <button
                key={d.id}
                onClick={() => { setDateFilter(d.id); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${dateFilter === d.id ? "bg-primary text-white font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Card list ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2.5 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search size={32} className="mb-3 opacity-30" />
            <p className="text-sm">未找到相关内容</p>
            <button onClick={() => { setKeyword(""); setActiveCategory("all"); setDateFilter("all"); setPage(1); }} className="mt-2 text-xs text-primary hover:underline">清除筛选条件</button>
          </div>
        ) : (
          paginatedEvents.map((event) => {
            const meta = catMeta(event.category);
            const eventId = `hot-${event.id}`;
            const official = industryData.find((article) => article.id === event.officialArticleId);
            const reason = official ? "官方来源发布相关政策或通报" : event.heat
              ? `${event.source}热度达到监测条件（${event.heat}）`
              : event.category === "incident" ? "命中异动监测规则" : `命中${catLabel(event.category)}类监测范围`;
            const sources = official ? [{ name: official.source, title: official.title, type: "官方通报", url: official.originalUrl }]
              : event.relatedSources ?? [{ name: event.source, title: event.title, type: "事件线索 · 示例" }];
            return (
              <div
                key={event.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group"
              >
                {/* Body */}
                <div className="px-4 py-3">
                  <button
                    onClick={() => setSelectedArticle({
                      id: eventId,
                      category: catLabel(event.category),
                      source: `${event.source} · ${event.location}`,
                      title: event.title,
                      publishedAt: event.date,
                      summary: event.summary,
                      keywords: [catLabel(event.category), event.location.replace("北京·", "")],
                      event: { reason, official: Boolean(official), sources },
                      summaryMode: "hotspot",
                      summarySource: official ? { articleId: official.id, originalUrl: official.originalUrl } : undefined,
                      context: event.heat
                        ? `该事件当前平台热度为 ${event.heat}，仍处于传播阶段。建议持续关注现场进展、权威部门回应及相关话题的热度变化。`
                        : "该事件已进入本地线索监测范围，建议进一步联系相关当事人和主管部门，交叉核实事实后推进报道。",
                    })}
                    className="block w-full text-left text-sm font-semibold text-foreground mb-1.5 group-hover:text-primary hover:text-primary transition-colors leading-snug"
                  >
                    {event.title}
                  </button>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2.5">
                    {event.summary}
                  </p>
                  {/* Meta row — tag, heat, location, date */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                      {catLabel(event.category)}
                    </span>
                    <HotspotBadge id={eventId} />

                    <span className={verified.includes(eventId) ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700" : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"}>{verified.includes(eventId) ? "已核实" : "待核实"}</span>
                    {official && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">已有官方通报</span>}
                    <span className="text-[11px] text-muted-foreground">入池 · {reason}</span>
                    <span className="text-[11px] text-muted-foreground">{sources.length} 条来源</span>
                    {event.heat && (
                      <span className="flex items-center gap-0.5 text-[11px] text-orange-500 font-medium">
                        <TrendingUp size={10} /> {event.heat}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{event.location}</span>
                    <span className="text-[11px] text-muted-foreground">{event.date}</span>
                  </div>
                  {/* Action row — pill ghost buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {official && <a
                      href={official.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-foreground/70 px-3.5 py-1.5 rounded-full border border-border bg-white hover:border-primary/40 hover:text-primary transition-all"
                    >
                      <ExternalLink size={11} /> 查看原文
                    </a>}
                    {actionButtons.map((btn) => (
                      <button
                        key={btn.id}
                        onClick={btn.id === "ai" ? () => onSearch(event.title) : () => toast.info(`${btn.label}流程暂未接入本地原型。`)}
                        className="flex items-center gap-1.5 text-[12px] text-foreground/70 px-3.5 py-1.5 rounded-full border border-border bg-white hover:border-primary/40 hover:text-primary transition-all"
                      >
                        {btn.icon} {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {filtered.length > 0 && (
        <ListPagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
        />
      )}
    </div>
  );
}

// ─── Competitor Tracking Page ──────────────────────────────────────────────────

const competitorAccounts = [
  {
    id: 1, name: "人民日报", platform: "微博", platformColor: "#E6162D",
    avatar: "人", followers: "3241万", works: 12840,
    lastPost: { title: "【早安！中国】7月28日，奋进新时代", summary: "聚焦全国多地重点工程、乡村振兴与民生服务新进展，以晨间图文和短视频形式呈现今日中国活力。", date: "2026-07-28", time: "今天 07:30", likes: "4.2万", comments: "8630", reposts: "2.1万", views: "1380万", tags: ["早安中国", "民生", "正能量"] },
    weeklyWorks: 48, growthRate: "+2.3%", engagementRate: "3.8%",
    category: "官方媒体",
  },
  {
    id: 2, name: "央视新闻", platform: "抖音", platformColor: "#161823",
    avatar: "央", followers: "1.24亿", works: 56320,
    lastPost: { title: "00后职校生世界技能大赛夺冠全过程", summary: "跟拍年轻技能人才备赛和决赛全过程，记录其在高压环境下完成关键操作并夺得金牌的高光时刻。", date: "2026-07-28", time: "今天 09:15", likes: "86万", comments: "4.2万", reposts: "23万", views: "4800万", tags: ["技能人才", "青年", "人物故事"] },
    weeklyWorks: 112, growthRate: "+1.1%", engagementRate: "5.2%",
    category: "官方媒体",
  },
  {
    id: 3, name: "新周刊", platform: "微信", platformColor: "#07C160",
    avatar: "新", followers: "680万", works: 3240,
    lastPost: { title: "年轻人，你的躺平是一种清醒的选择吗", summary: "从职场压力、生活成本与代际观念切入，讨论年轻人重新定义成功和工作意义的社会现象。", date: "2026-07-27", time: "昨天 22:00", likes: "1.8万", comments: "3420", reposts: "9600", views: "230万", tags: ["年轻人", "职场", "社会观察"] },
    weeklyWorks: 14, growthRate: "+0.8%", engagementRate: "4.1%",
    category: "媒体",
  },
  {
    id: 4, name: "虎嗅网", platform: "微博", platformColor: "#E6162D",
    avatar: "虎", followers: "362万", works: 18920,
    lastPost: { title: "字节跳动即梦AI 2.0发布：对标Sora的国产答案", summary: "解析即梦AI视频生成能力升级、产品定价与企业API策略，并对比国内外主流视频生成模型。", date: "2026-07-28", time: "今天 11:40", likes: "6300", comments: "1240", reposts: "4200", views: "89万", tags: ["AI视频", "产品发布", "科技"] },
    weeklyWorks: 35, growthRate: "+3.6%", engagementRate: "2.9%",
    category: "科技媒体",
  },
];

const competitorAccountSources: Record<number, string> = {
  1: "competitor-people", 2: "competitor-cctv", 3: "competitor-neweekly", 4: "competitor-huxiu",
};

const guangmingWork = industryData.find((article) => article.id === 6)!;
const competitorWorks = [
  ...competitorAccounts.map((account) => ({
    id: `account-${account.id}`, subscriptionId: competitorAccountSources[account.id],
    name: account.name, platform: account.platform, avatar: account.avatar, color: account.platformColor,
    descriptor: `${account.category} · ${account.followers}粉丝`,
    ...account.lastPost,
    productUpdate: account.lastPost.tags.includes("产品发布") ? "产品发布" : undefined,
    original: undefined as ArticleSummarySource | undefined,
  })),
  {
    id: "site-guangming-6", subscriptionId: "competitor-site-guangming",
    name: "光明网", platform: "网站", avatar: "光", color: "#e11d48",
    descriptor: "网站订阅", title: guangmingWork.title, summary: guangmingWork.summary,
    date: guangmingWork.date, time: guangmingWork.date, tags: guangmingWork.tags,
    likes: null, comments: null, reposts: null, views: null,
    productUpdate: "内容运营动态", original: { articleId: guangmingWork.id, originalUrl: guangmingWork.originalUrl },
  },
];

type CompetitorSourceSettings = {
  sites: string[];
  accounts: string[];
};

const COMPETITOR_SOURCE_POOLS: Record<keyof CompetitorSourceSettings, SourceOption[]> = {
  accounts: [
    { id: "competitor-people", name: "@人民日报", desc: "微博 · 官方媒体账号" },
    { id: "competitor-cctv", name: "@央视新闻", desc: "抖音 · 官方新闻账号" },
    { id: "competitor-neweekly", name: "新周刊", desc: "微信 · 社会观察媒体" },
    { id: "competitor-huxiu", name: "@虎嗅APP", desc: "微博 · 科技商业媒体" },
    { id: "competitor-36kr", name: "@36氪", desc: "微博 · 创投科技媒体" },
    { id: "competitor-tmtpost", name: "@钛媒体", desc: "抖音 · 科技财经媒体" },
  ],
  sites: [
    { id: "competitor-site-huxiu", name: "虎嗅网", desc: "科技与商业资讯网站" },
    { id: "competitor-site-36kr", name: "36氪", desc: "创业与科技资讯网站" },
    { id: "competitor-site-tmtpost", name: "钛媒体", desc: "科技财经资讯网站" },
    { id: "competitor-site-newrank", name: "新榜", desc: "新媒体数据与内容平台" },
    { id: "competitor-site-guangming", name: "光明网", desc: "媒体产品与内容运营动态" },
    { id: "competitor-site-qbitai", name: "量子位", desc: "人工智能行业资讯网站" },
  ],
};

const DEFAULT_COMPETITOR_SOURCE_SETTINGS: CompetitorSourceSettings = {
  accounts: ["competitor-people", "competitor-cctv", "competitor-neweekly", "competitor-huxiu"],
  sites: ["competitor-site-huxiu", "competitor-site-36kr", "competitor-site-guangming"],
};

function CompetitorSourceSettingsModal({
  initialSettings,
  onClose,
  onSave,
}: {
  initialSettings: CompetitorSourceSettings;
  onClose: () => void;
  onSave: (settings: CompetitorSourceSettings, asBasePackage?: boolean) => void;
}) {
  const [draft, setDraft] = useState<CompetitorSourceSettings>(() => ({
    accounts: [...initialSettings.accounts],
    sites: [...initialSettings.sites],
  }));
  const [sourceType, setSourceType] = useState<keyof CompetitorSourceSettings>("accounts");
  const [searchQuery, setSearchQuery] = useState("");
  const selectedIds = draft[sourceType];
  const sourceItems = COMPETITOR_SOURCE_POOLS[sourceType].filter((item) =>
    searchQuery.trim() === "" ||
    item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    item.desc.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const toggleSource = (id: string) => {
    setDraft((current) => ({
      ...current,
      [sourceType]: current[sourceType].includes(id)
        ? current[sourceType].filter((item) => item !== id)
        : [...current[sourceType], id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-2xl h-[580px] max-h-[86vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center">
          <h2 className="text-base font-semibold text-foreground">竞品跟踪设置</h2>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-6 overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-3 mb-5">
            <div className="inline-flex bg-muted rounded-lg p-1">
              {([
                { id: "accounts", label: "社媒账号" },
                { id: "sites", label: "网站站点" },
              ] as const).map((type) => (
                <button
                  key={type.id}
                  onClick={() => { setSourceType(type.id); setSearchQuery(""); }}
                  className={`px-4 py-1.5 rounded-md text-xs transition-all ${
                    sourceType === type.id ? "bg-white text-primary shadow-sm font-medium" : "text-muted-foreground"
                  }`}
                >
                  {type.label}
                  <span className="ml-1.5 text-[10px]">{draft[type.id].length}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto w-56 flex items-center bg-white border border-border rounded-lg px-3 py-2 gap-2 focus-within:border-primary">
              <Search size={13} className="text-muted-foreground flex-shrink-0" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={sourceType === "accounts" ? "搜索社媒账号..." : "搜索网站站点..."}
                className="flex-1 min-w-0 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
              />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="text-muted-foreground"><X size={12} /></button>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {sourceItems.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleSource(item.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/30"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                    selected ? "bg-primary border-primary text-white" : "border-border text-transparent"
                  }`}>
                    <Check size={12} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{item.name}</span>
                    <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{item.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {sourceItems.length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground">未找到匹配的数据源</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <button onClick={onClose} className="ml-auto text-sm text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted">取消</button>
          <button onClick={() => onSave(draft, true)} className="text-sm text-primary bg-white border border-primary/25 px-4 py-2 rounded-lg hover:bg-primary/5 hover:border-primary/40 font-medium transition-colors">保存并设为基础数据包</button>
          <button onClick={() => onSave(draft)} className="text-sm bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary/90 font-medium shadow-sm">提交</button>
        </div>
      </div>
    </div>
  );
}

function CompetitorPage({ onSearch }: { onSearch: (query: string) => void }) {
  const [tab, setTab] = useState<"accounts" | "works" | "products">("accounts");
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [showSourceSettings, setShowSourceSettings] = useState(false);
  const [sourceSettings, setSourceSettings, settingsFeedback] = usePreviewSettings("competitor-sources", DEFAULT_COMPETITOR_SOURCE_SETTINGS);
  const [channelFilter, setChannelFilter] = useState("all");
  const [publishFilter, setPublishFilter] = useState("all");
  const [competitorKeyword, setCompetitorKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const channelOptions = ["全部渠道", "微博", "抖音", "微信", "网站"];
  const publishOptions = [
    { id: "all", label: "全部时间" },
    { id: "today", label: "今日" },
    { id: "yesterday", label: "昨日" },
    { id: "7days", label: "近7天" },
  ];
  const today = newsroomDaysBefore(0);
  const matchPublishDate = (date: string) => dateMatches(date, publishFilter, today);
  const subscribedSources = new Set([...sourceSettings.accounts, ...sourceSettings.sites]);
  const filteredAccounts = competitorAccounts.filter((account) => {
    const matchChannel = channelFilter === "all" || account.platform === channelFilter;
    const matchKeyword = [account.name, account.category, account.lastPost.title].some((value) => value.includes(competitorKeyword));
    return subscribedSources.has(competitorAccountSources[account.id]) && matchChannel && matchPublishDate(account.lastPost.date) && matchKeyword;
  });
  const filteredWorks = competitorWorks.filter((work) =>
    subscribedSources.has(work.subscriptionId) &&
    (tab !== "products" || work.productUpdate) &&
    (channelFilter === "all" || work.platform === channelFilter) &&
    matchPublishDate(work.date) &&
    [work.name, work.title, work.summary, ...work.tags].some((value) => value.includes(competitorKeyword)));
  const currentTotal = tab === "accounts" ? filteredAccounts.length : filteredWorks.length;
  const paginatedAccounts = filteredAccounts.slice((page - 1) * pageSize, page * pageSize);
  const paginatedWorks = filteredWorks.slice((page - 1) * pageSize, page * pageSize);
  const workActions = [
    { id: "original", label: "查看原文", icon: <ExternalLink size={11} /> },
    { id: "reference", label: "借鉴创作", icon: <Pencil size={11} /> },
    { id: "report", label: "去报题", icon: <Send size={11} /> },
    { id: "ai", label: "AI灵感搜索", icon: <Brain size={11} /> },
  ];

  const handleWorkAction = (action: typeof workActions[number], title: string, originalUrl?: string) => {
    if (action.id === "ai") {
      onSearch(title);
    } else if (action.id === "original") {
      if (originalUrl) window.open(originalUrl, "_blank", "noopener,noreferrer");
      else toast.info("当前作品暂无原文链接。");
    } else {
      toast.info(`${action.label}流程暂未接入本地原型。`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {settingsFeedback && <p role="status" className="mb-2 text-xs text-muted-foreground">{settingsFeedback}</p>}
      {selectedArticle && <ArticleDetailDrawer showAiSummary onSearch={onSearch} article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
      {showSourceSettings && (
        <CompetitorSourceSettingsModal
          initialSettings={sourceSettings}
          onClose={() => setShowSourceSettings(false)}
          onSave={(settings, asBasePackage) => { setSourceSettings(settings, asBasePackage); setPage(1); setShowSourceSettings(false); }}
        />
      )}
      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <button onClick={() => { setTab("accounts"); setPage(1); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${tab === "accounts" ? "bg-primary text-white border-primary shadow-sm" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"}`}>
          <Users size={14} /> 对标账号
        </button>
        <button onClick={() => { setTab("works"); setPage(1); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${tab === "works" ? "bg-primary text-white border-primary shadow-sm" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"}`}>
          <Newspaper size={14} /> 最新作品
        </button>
        <button onClick={() => { setTab("products"); setPage(1); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${tab === "products" ? "bg-primary text-white border-primary shadow-sm" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"}`}>
          <Building2 size={14} /> 产品动态
        </button>
        <button
          onClick={() => setShowSourceSettings(true)}
          className="ml-auto flex items-center gap-1.5 text-xs bg-white border border-border text-foreground px-3.5 py-2 rounded-lg hover:border-primary/40 hover:text-primary transition-all shadow-sm"
        >
          <Settings size={13} /> 数据源设置
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {channelOptions.map((channel) => {
              const id = channel === "全部渠道" ? "all" : channel;
              return (
                <button
                  key={channel}
                  onClick={() => { setChannelFilter(id); setPage(1); }}
                  className={`text-xs px-3.5 py-2 rounded-lg border font-medium transition-all whitespace-nowrap ${
                    channelFilter === id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  {channel}
                </button>
              );
            })}
          </div>
          <div className="w-56 flex-shrink-0 flex items-center bg-card border border-border rounded-lg px-3 py-2 gap-2">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              value={competitorKeyword}
              onChange={(event) => { setCompetitorKeyword(event.target.value); setPage(1); }}
              placeholder={tab === "accounts" ? "搜索账号、作品..." : "搜索作品、关键词..."}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {competitorKeyword && (
              <button onClick={() => { setCompetitorKeyword(""); setPage(1); }} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
            {publishOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => { setPublishFilter(option.id); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                  publishFilter === option.id ? "bg-primary text-white font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* ── Accounts tab ── */}
        {tab === "accounts" && (
          <div className="space-y-3 pb-4">
            {paginatedAccounts.map((acc) => (
              <div key={acc.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all">
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3 bg-white border-b border-border">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm" style={{ backgroundColor: acc.platformColor }}>{acc.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{acc.name}</span>
                      <span className="text-[11px] bg-white/60 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200/50">{acc.platform}</span>
                      <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{acc.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span>粉丝 <strong className="text-foreground">{acc.followers}</strong></span>
                      <span>作品 <strong className="text-foreground">{acc.works.toLocaleString()}</strong></span>
                      <span>周更 <strong className="text-foreground">{acc.weeklyWorks}条</strong></span>
                      <span className="text-green-600 font-medium">{acc.growthRate} 本周增粉</span>
                      <span>互动率 <strong className="text-foreground">{acc.engagementRate}</strong></span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 text-[12px] text-foreground/70 px-3.5 py-1.5 rounded-full border border-border bg-white hover:border-primary/40 hover:text-primary transition-all flex-shrink-0">查看主页</button>
                </div>
                {/* Latest post */}
                <div className="px-4 py-3">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">最新作品</div>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setSelectedArticle({
                          id: `competitor-account-${acc.id}`,
                          category: "竞品账号动态",
                          summaryMode: "competitor",
                          source: `${acc.name} · ${acc.platform}`,
                          title: acc.lastPost.title,
                          publishedAt: acc.lastPost.time,
                          summary: `${acc.name}发布最新作品，当前获得${acc.lastPost.likes}点赞、${acc.lastPost.comments}条评论、${acc.lastPost.reposts}次转发，累计浏览量${acc.lastPost.views}。该内容可用于分析竞品选题方向、内容节奏与受众互动表现。`,
                          keywords: [acc.category, acc.platform, "竞品内容", "传播表现"],
                          context: `账号当前拥有${acc.followers}粉丝，本周发布${acc.weeklyWorks}条内容，互动率为${acc.engagementRate}，本周粉丝增长${acc.growthRate}。`,
                        })}
                        className="block w-full text-left text-sm text-foreground font-medium leading-snug mb-1.5 hover:text-primary transition-colors"
                      >
                        {acc.lastPost.title}
                      </button>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Heart size={10} className="text-rose-400" /> {acc.lastPost.likes}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare size={10} className="text-blue-400" /> {acc.lastPost.comments}</span>
                        <span className="flex items-center gap-0.5"><RefreshCw size={10} className="text-green-500" /> {acc.lastPost.reposts}</span>
                        <span className="flex items-center gap-0.5"><Eye size={10} className="text-purple-400" /> {acc.lastPost.views}</span>
                        <span className="ml-auto">{acc.lastPost.time}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {workActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleWorkAction(action, acc.lastPost.title)}
                          className="flex items-center gap-1.5 text-[12px] text-foreground/70 px-3.5 py-1.5 rounded-full border border-border bg-white hover:border-primary/40 hover:text-primary transition-all"
                        >
                          {action.icon}{action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab !== "accounts" && (
          <div className="space-y-3 pb-4">
            {!paginatedWorks.length && <p className="py-16 text-center text-sm text-muted-foreground">当前订阅范围内暂无匹配作品</p>}
            {paginatedWorks.map((work) => {
              const metrics = [
                { label: "点赞", value: work.likes, icon: Heart, color: "text-rose-400" },
                { label: "评论", value: work.comments, icon: MessageSquare, color: "text-blue-400" },
                { label: "转发", value: work.reposts, icon: RefreshCw, color: "text-green-500" },
                { label: "浏览", value: work.views, icon: Eye, color: "text-purple-400" },
              ];
              const openDetail = () => setSelectedArticle({
                id: `competitor-${work.id}`,
                category: "竞品作品",
                source: `${work.name} · ${work.platform}`,
                title: work.title,
                publishedAt: work.time.includes(work.date) ? work.date : `${work.date} ${work.time.replace(/^(今天|昨天) /, "")}`,
                summary: work.summary,
                keywords: work.tags,
                metadata: metrics.map(({ label, value }) => [label, value ?? "未获取"]),
                summaryMode: "competitor",
                summarySource: work.original,
                context: "结合发布渠道、作品内容和可用的互动数据观察其选题与内容策略。",
              });
              return (
                <article key={work.id} className="group overflow-hidden rounded-xl border border-border bg-white transition-all hover:border-primary/30 hover:shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: work.color }}>{work.avatar}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{work.name}</span>
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{work.platform}</span>
                        {work.productUpdate && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{work.productUpdate}</span>}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{work.descriptor}</span>
                    </div>
                    <time className="ml-auto text-[11px] text-muted-foreground">{work.time}</time>
                  </div>
                  <div className="px-4 py-3">
                    <button onClick={openDetail} className="mb-1.5 block w-full text-left text-sm font-semibold leading-snug hover:text-primary">{work.title}</button>
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{work.summary}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {metrics.map(({ label, value, icon: Icon, color }) => <span key={label} className="flex items-center gap-1"><Icon size={11} className={color} />{label} {value ?? "未获取"}</span>)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {work.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">#{tag}</span>)}
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        {workActions.map((action) => (
                          <button key={action.id} onClick={() => handleWorkAction(action, work.title, work.original?.originalUrl)}
                            className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-[12px] text-foreground/70 hover:border-primary/40 hover:text-primary">
                            {action.icon}{action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <ListPagination
        total={currentTotal}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
      />
    </div>
  );
}

// ─── Industry Insights Page ─────────────────────────────────────────────────────

const INDUSTRY_CATS = [
  { id: "all",      label: "全部",       activeClass: "bg-foreground text-white" },
  { id: "news",     label: "行业新闻",   activeClass: "bg-sky-500 text-white" },
  { id: "gov",      label: "政府公告",   activeClass: "bg-red-500 text-white" },
  { id: "policy",   label: "政策解读",   activeClass: "bg-orange-500 text-white" },
  { id: "customer", label: "客户动态",   activeClass: "bg-green-500 text-white" },
];

const INDUSTRY_TYPE_META: Record<string, { bg: string; text: string }> = {
  news:     { bg: "bg-sky-100",    text: "text-sky-700" },
  gov:      { bg: "bg-red-100",    text: "text-red-600" },
  policy:   { bg: "bg-orange-100", text: "text-orange-600" },
  customer: { bg: "bg-green-100",  text: "text-green-700" },
};

type IndustrySourceCategory = "news" | "gov" | "policy" | "customer";
type IndustrySourceType = "sites" | "accounts";
type IndustrySourceSettings = Record<IndustrySourceCategory, Record<IndustrySourceType, string[]>>;

const INDUSTRY_SOURCE_POOLS: Record<IndustrySourceCategory, Record<IndustrySourceType, SourceOption[]>> = {
  news: {
    sites: [
      { id: "news-xinhua", name: "新华网传媒频道", desc: "传媒行业新闻与趋势" },
      { id: "news-people", name: "人民网传媒频道", desc: "媒体融合与行业资讯" },
      { id: "news-chinanews", name: "中国新闻网", desc: "国内外新闻行业动态" },
      { id: "news-caixin", name: "财新网", desc: "财经与传媒深度报道" },
    ],
    accounts: [
      { id: "news-media-talk", name: "@传媒茶话会", desc: "传媒行业观察账号" },
      { id: "news-bjnews", name: "@新京报", desc: "新闻与融媒体动态" },
      { id: "news-jiemian", name: "@界面新闻", desc: "商业与行业资讯账号" },
    ],
  },
  gov: {
    sites: [
      { id: "gov-state", name: "中国政府网", desc: "国务院政务信息与公告" },
      { id: "gov-cac", name: "国家互联网信息办公室", desc: "网信政策与官方公告" },
      { id: "gov-nrta", name: "国家广播电视总局", desc: "广播电视行业公告" },
      { id: "gov-mct", name: "文化和旅游部", desc: "文化传媒相关政务信息" },
    ],
    accounts: [
      { id: "gov-state-account", name: "@中国政府网", desc: "国务院官方政务账号" },
      { id: "gov-cac-account", name: "@网信中国", desc: "国家网信办官方账号" },
      { id: "gov-nrta-account", name: "@国家广电总局", desc: "广电总局官方账号" },
    ],
  },
  policy: {
    sites: [
      { id: "policy-library", name: "国务院政策文件库", desc: "国家政策文件权威入口" },
      { id: "policy-ndrc", name: "国家发展改革委", desc: "产业与数字经济政策" },
      { id: "policy-copyright", name: "国家版权局", desc: "版权政策与行业规范" },
      { id: "policy-npc", name: "中国人大网", desc: "法律法规与草案解读" },
    ],
    accounts: [
      { id: "policy-ndrc-account", name: "@国家发展改革委", desc: "宏观与产业政策发布" },
      { id: "policy-copyright-account", name: "@中国版权", desc: "版权政策解读账号" },
      { id: "policy-law-account", name: "@法治日报", desc: "法律政策专业解读" },
    ],
  },
  customer: {
    sites: [
      { id: "customer-guangming", name: "光明网", desc: "明确订阅的客户 · 媒体业务动态" },
      { id: "customer-xinhua", name: "新华社", desc: "中央媒体业务动态" },
      { id: "customer-beijing", name: "北京日报客户端", desc: "地方融媒体建设动态" },
      { id: "customer-smg", name: "上海广播电视台", desc: "广电与内容产品动态" },
      { id: "customer-zhejiang", name: "浙江广电集团", desc: "融媒体与技术应用动态" },
    ],
    accounts: [
      { id: "customer-xinhua-account", name: "@新华社", desc: "新华社官方融媒账号" },
      { id: "customer-beijing-account", name: "@北京日报", desc: "北京日报官方账号" },
      { id: "customer-cctv-account", name: "@央视新闻", desc: "央视新闻官方账号" },
    ],
  },
};

const DEFAULT_INDUSTRY_SOURCE_SETTINGS: IndustrySourceSettings = {
  news: { sites: ["news-xinhua", "news-people"], accounts: ["news-media-talk"] },
  gov: { sites: ["gov-state", "gov-cac"], accounts: ["gov-state-account"] },
  policy: { sites: ["policy-library", "policy-copyright"], accounts: ["policy-ndrc-account"] },
  customer: { sites: ["customer-xinhua", "customer-beijing", "customer-guangming"], accounts: ["customer-xinhua-account"] },
};

function IndustrySourceSettingsModal({
  initialSettings,
  onClose,
  onSave,
}: {
  initialSettings: IndustrySourceSettings;
  onClose: () => void;
  onSave: (settings: IndustrySourceSettings, asBasePackage?: boolean) => void;
}) {
  const [draft, setDraft] = useState<IndustrySourceSettings>(() => ({
    news: { sites: [...initialSettings.news.sites], accounts: [...initialSettings.news.accounts] },
    gov: { sites: [...initialSettings.gov.sites], accounts: [...initialSettings.gov.accounts] },
    policy: { sites: [...initialSettings.policy.sites], accounts: [...initialSettings.policy.accounts] },
    customer: { sites: [...initialSettings.customer.sites], accounts: [...initialSettings.customer.accounts] },
  }));
  const [activeCategory, setActiveCategory] = useState<IndustrySourceCategory>("news");
  const [sourceType, setSourceType] = useState<IndustrySourceType>("sites");
  const [searchQuery, setSearchQuery] = useState("");

  const categoryOptions: { id: IndustrySourceCategory; label: string }[] = [
    { id: "news", label: "行业新闻" },
    { id: "gov", label: "政府公告" },
    { id: "policy", label: "政策解读" },
    { id: "customer", label: "客户动态" },
  ];
  const selectedIds = draft[activeCategory][sourceType];
  const sourceItems = INDUSTRY_SOURCE_POOLS[activeCategory][sourceType].filter((item) =>
    searchQuery.trim() === "" ||
    item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    item.desc.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const toggleSource = (id: string) => {
    setDraft((current) => {
      const selected = current[activeCategory][sourceType];
      return {
        ...current,
        [activeCategory]: {
          ...current[activeCategory],
          [sourceType]: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
        },
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-3xl h-[650px] max-h-[88vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center">
          <h2 className="text-base font-semibold text-foreground">行业洞察设置</h2>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-44 flex-shrink-0 bg-muted/50 border-r border-border p-3 space-y-1">
            {categoryOptions.map((category) => {
              const count = draft[category.id].sites.length + draft[category.id].accounts.length;
              return (
                <button
                  key={category.id}
                  onClick={() => { setActiveCategory(category.id); setSearchQuery(""); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                    activeCategory === category.id
                      ? "bg-white text-primary font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                  }`}
                >
                  <span className="flex-1">{category.label}</span>
                  <span className="text-[10px] min-w-5 h-5 px-1 rounded-full bg-primary/10 text-primary flex items-center justify-center">{count}</span>
                  <ChevronRight size={12} className="opacity-40" />
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-0 p-6 overflow-y-auto scrollbar-hide">
            <div className="flex items-center gap-2 mb-5">
              <div className="inline-flex bg-muted rounded-lg p-1">
                {([
                  { id: "sites", label: "网站站点" },
                  { id: "accounts", label: "社媒账号" },
                ] as const).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { setSourceType(type.id); setSearchQuery(""); }}
                    className={`px-4 py-1.5 rounded-md text-xs transition-all ${
                      sourceType === type.id ? "bg-white text-primary shadow-sm font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto w-56 flex items-center bg-white border border-border rounded-lg px-3 py-2 gap-2 focus-within:border-primary">
                <Search size={13} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={sourceType === "sites" ? "搜索网站站点..." : "搜索社媒账号..."}
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="text-muted-foreground"><X size={12} /></button>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {sourceItems.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSource(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/30"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      selected ? "bg-primary border-primary text-white" : "border-border text-transparent"
                    }`}>
                      <Check size={12} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{item.name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{item.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {sourceItems.length === 0 && (
              <div className="py-16 text-center text-xs text-muted-foreground">未找到匹配的数据源</div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <button onClick={onClose} className="ml-auto text-sm text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted">取消</button>
          <button onClick={() => onSave(draft, true)} className="text-sm text-primary bg-white border border-primary/25 px-4 py-2 rounded-lg hover:bg-primary/5 hover:border-primary/40 font-medium transition-colors">保存并设为基础数据包</button>
          <button onClick={() => onSave(draft)} className="text-sm bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary/90 font-medium shadow-sm">提交</button>
        </div>
      </div>
    </div>
  );
}

function IndustryPage({ onSearch }: { onSearch: (query: string) => void }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [showSourceSettings, setShowSourceSettings] = useState(false);
  const [sourceSettings, setSourceSettings, settingsFeedback] = usePreviewSettings("industry-sources", DEFAULT_INDUSTRY_SOURCE_SETTINGS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const dateOptions = [
    { id: "all", label: "全部日期" },
    { id: "today", label: "今日" },
    { id: "yesterday", label: "昨日" },
    { id: "3days", label: "近3天" },
  ];

  const today = newsroomDaysBefore(0);
  const subscribedSources = new Set(Object.values(sourceSettings).flatMap(({ sites, accounts }) => [...sites, ...accounts]));
  const visibleCategories = (item: typeof industryData[number]) => item.categories.filter((id) =>
    id !== "customer" || (item.customerId != null && sourceSettings.customer.sites.includes(item.customerId)));
  const filtered = industryData.filter((item) => {
    if (!subscribedSources.has(item.subscriptionId) || !visibleCategories(item).length) return false;
    const matchCat = activeCategory === "all" || visibleCategories(item).includes(activeCategory);
    const matchKw  = keyword === "" || item.title.includes(keyword) || item.summary.includes(keyword) || item.tags.some((tag) => tag.includes(keyword));
    return matchCat && matchKw && dateMatches(item.date, dateFilter, today);
  });
  const paginatedIndustry = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col h-full">
      {settingsFeedback && <p role="status" className="mb-2 text-xs text-muted-foreground">{settingsFeedback}</p>}
      {selectedArticle && <ArticleDetailDrawer showAiSummary onSearch={onSearch} article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
      {showSourceSettings && (
        <IndustrySourceSettingsModal
          initialSettings={sourceSettings}
          onClose={() => setShowSourceSettings(false)}
          onSave={(settings, asBasePackage) => { setSourceSettings(settings, asBasePackage); setPage(1); setShowSourceSettings(false); }}
        />
      )}
      {/* Filters */}
      <div className="flex-shrink-0 space-y-3 mb-4">
        <div className="flex items-center">
          <h2 className="text-base font-semibold text-foreground">行业洞察</h2>
          <button
            onClick={() => setShowSourceSettings(true)}
            className="ml-auto flex items-center gap-1.5 text-xs bg-white border border-border text-foreground px-3.5 py-2 rounded-lg hover:border-primary/40 hover:text-primary transition-all shadow-sm"
          >
            <Settings size={13} /> 数据源设置
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {INDUSTRY_CATS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setPage(1); }}
                className={`text-xs px-3.5 py-2 rounded-lg border font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="w-56 flex-shrink-0 flex items-center bg-card border border-border rounded-lg px-3 py-2 gap-2">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="搜索标题、关键词..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {keyword && <button onClick={() => { setKeyword(""); setPage(1); }} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>}
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
            {dateOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => { setDateFilter(option.id); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                dateFilter === option.id ? "bg-primary text-white font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2.5 pb-4">
        {!paginatedIndustry.length && <p className="py-16 text-center text-sm text-muted-foreground">当前订阅范围内暂无匹配稿件</p>}
        {paginatedIndustry.map((item) => {
          const categories = visibleCategories(item);
          const catLabel = categories.map((id) => INDUSTRY_CATS.find((cat) => cat.id === id)?.label ?? id).join(" · ");
          const openDetail = () => setSelectedArticle({
            id: `industry-${item.id}`,
            category: catLabel,
            source: item.source,
            title: item.title,
            publishedAt: item.date,
            summary: item.summary,
            keywords: item.tags,
            summarySource: { articleId: item.id, originalUrl: item.originalUrl },
            summaryMode: "industry",
            metadata: [["原创识别", item.originality], ["地域", item.region], ["分类", catLabel]],
            context: "分类与关键词来自稿件入库时的数据处理结果。",
          });
          const actions = [
            { label: "查看原文", icon: ExternalLink, onClick: () => window.open(item.originalUrl, "_blank", "noopener,noreferrer") },
            { label: "去创作", icon: Pencil, onClick: () => toast.info("去创作流程暂未接入本地原型。") },
            { label: "去报题", icon: Send, onClick: () => toast.info("去报题流程暂未接入本地原型。") },
            { label: "AI灵感搜索", icon: Brain, onClick: () => onSearch(item.title) },
          ];
          return (
            <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group">
              {/* Header */}
              <div className="px-4 py-2.5 flex items-center gap-2 bg-white border-b border-border">
                {categories.map((id) => {
                  const meta = INDUSTRY_TYPE_META[id] ?? { bg: "bg-gray-100", text: "text-gray-600" };
                  return <span key={id} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>{INDUSTRY_CATS.find((cat) => cat.id === id)?.label ?? id}</span>;
                })}
                <span className="text-[11px] text-muted-foreground">{item.region} · {item.originality}</span>
                {item.isImportant && <span className="text-[11px] text-red-600 bg-red-100/80 px-1.5 py-0.5 rounded-full font-medium">重要</span>}
                <span className="text-[11px] text-foreground font-medium">{item.source}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{item.date}</span>
              </div>
              {/* Body */}
              <div className="px-4 py-3">
                <button
                  onClick={openDetail}
                  className="block w-full text-left text-sm font-semibold text-foreground mb-1.5 group-hover:text-primary hover:text-primary transition-colors leading-snug"
                >
                  {item.title}
                </button>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{item.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((t) => <span key={t} className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">#{t}</span>)}
                  </div>
                  <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                    {actions.map(({ label, icon: Icon, onClick }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={onClick}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-3.5 py-1.5 text-xs text-foreground/70 transition-all hover:border-primary/40 hover:text-primary"
                      >
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length > 0 && (
        <ListPagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
        />
      )}
    </div>
  );
}

// ─── Briefing Page ─────────────────────────────────────────────────────────────

type BriefingItem = { headline: string; desc: string; originalUrl: string; source: string };
type BriefingEntry = {
  id: string;
  type: "morning" | "evening";
  date: string;
  items: BriefingItem[];
  suggestion?: string;
};

const briefingPreview: BriefingEntry[] = [
  { date: "2026-11-04", type: "evening", articleIds: [1], suggestion: "可对照两份蓝皮书，找出国内外人工智能应用和治理实践的差异。" },
  { date: "2026-09-15", type: "evening", articleIds: [2], suggestion: "可从入选案例切入，跟踪人工智能在网络安全场景中的实际效果。" },
  { date: "2026-05-13", type: "morning", articleIds: [3], suggestion: "可梳理短视频内容标注的变化，说明发布者需要关注哪些环节。" },
].map(({ date, type, articleIds, suggestion }) => ({
  id: `${date}-${type}`, date, type: type === "morning" ? "morning" : "evening", suggestion,
  items: industryData.filter(({ id }) => articleIds.includes(id))
    .map(({ title, summary, originalUrl, source }) => ({ headline: title, desc: summary, originalUrl, source })),
}));

const briefingEndpoint = import.meta.env.VITE_NEWS_BRIEFING_API;
const briefingDate = (date: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeZone: "Asia/Shanghai" }).format(new Date(`${date}T12:00:00+08:00`));
const briefingLabel = (type: BriefingEntry["type"]) => type === "morning" ? "早报" : "晚报";
const briefingTime = (type: BriefingEntry["type"]) => type === "morning" ? "08:00" : "20:00";

function BriefingPage() {
  const [entries, setEntries] = useState<BriefingEntry[]>(briefingEndpoint ? [] : briefingPreview);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(briefingEndpoint ? "loading" : "ready");

  useEffect(() => {
    if (!briefingEndpoint) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(briefingEndpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data?.items)) throw new Error();
        if (controller.signal.aborted) return;
        const published = (data.items as BriefingEntry[]).filter((issue) =>
          issue && /^\d{4}-\d{2}-\d{2}$/.test(issue.date) && Number.isFinite(Date.parse(issue.date)) &&
          (issue.type === "morning" || issue.type === "evening") && Array.isArray(issue.items) &&
          issue.items.length && issue.items.every((item) => item && /^https?:\/\//i.test(item.originalUrl)));
        const unique = new Map(published.map((issue) => [`${issue.date}-${issue.type}`, issue]));
        setEntries([...unique.values()]);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || briefingTime(b.type).localeCompare(briefingTime(a.type)));
  const entry = sorted.find(({ id }) => id === selectedId) ?? sorted[0];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-white px-4 py-3">
        <h2 className="text-sm font-semibold">新闻早晚报</h2>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary">机构共享</span>
        <span className="text-xs text-muted-foreground">每日 08:00 早报 · 20:00 晚报 · 自动生成并归档</span>
        {!briefingEndpoint && <span className="ml-auto text-[11px] text-muted-foreground">历史样例</span>}
      </div>
      {status === "error" && <p role="status" className="text-xs text-amber-700">暂时无法同步最新简报。</p>}
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <main className="overflow-y-auto rounded-xl border border-border bg-white p-5 md:p-6">
          {entry ? <>
            <div className="border-b border-border pb-4">
              <p className="text-xs text-muted-foreground">{briefingDate(entry.date)} · {briefingTime(entry.type)}</p>
              <h3 className="mt-2 text-lg font-semibold">新闻{briefingLabel(entry.type)}</h3>
            </div>
            <ol className="divide-y divide-border">
              {entry.items.map((item, index) => (
                <li key={item.originalUrl + index} className="flex gap-3 py-4">
                  <span className="w-5 shrink-0 text-right text-xs leading-5 text-muted-foreground">{index + 1}.</span>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{item.headline}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{item.source}</span>
                      <a href={item.originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink size={12} /> 查看原文</a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {entry.suggestion && <div className="flex gap-2 rounded-lg bg-blue-50/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <Sparkles size={14} className="shrink-0 text-primary" />
              <p><strong className="mr-2 text-primary">创作建议</strong>{entry.suggestion}</p>
            </div>}
          </> : <p className="py-12 text-center text-sm text-muted-foreground">{status === "loading" ? "正在同步简报…" : "暂无已生成简报"}</p>}
        </main>
        <aside className="overflow-y-auto rounded-xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">历史简报</h3>
            {selectedId && <button onClick={() => setSelectedId(undefined)} className="text-xs text-primary">回到最新</button>}
          </div>
          {sorted.map((issue, index) => <div key={issue.id}>
            {sorted[index - 1]?.date !== issue.date && <p className="mb-1 mt-3 text-[11px] text-muted-foreground">{issue.date}</p>}
            <button onClick={() => setSelectedId(issue.id)} aria-pressed={entry?.id === issue.id}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs ${entry?.id === issue.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <span>{briefingLabel(issue.type)}</span><span>{briefingTime(issue.type)}</span>
            </button>
          </div>)}
        </aside>
      </div>
    </div>
  );
}

// ─── Social Trends Page ────────────────────────────────────────────────────────

const platformHotItems: Record<string, { rank: number; title: string; heat: string }[]> = {
  weibo:       [{ rank: 1, title: "王红收到名校推荐信", heat: "982万" }, { rank: 2, title: "国务院数字经济新政落地", heat: "756万" }, { rank: 3, title: "世界技能大赛中国夺冠", heat: "643万" }, { rank: 4, title: "美联储维持利率不变", heat: "521万" }, { rank: 5, title: "北京暴雨蓝色预警", heat: "389万" }],
  douyin:      [{ rank: 1, title: "职校00后满分夺冠视频", heat: "1.5亿" }, { rank: 2, title: "夏日防溺水公益挑战", heat: "8800万" }, { rank: 3, title: "城市绿化带生态修复", heat: "4200万" }, { rank: 4, title: "骑手一天送单实录", heat: "3100万" }, { rank: 5, title: "AI写作被老师发现了", heat: "2700万" }],
  zhihu:       [{ rank: 1, title: "为什么越来越多年轻人选择躺平", heat: "456万" }, { rank: 2, title: "数字经济对普通人意味着什么", heat: "312万" }, { rank: 3, title: "职校生是否被社会低估了", heat: "287万" }, { rank: 4, title: "媒体信任危机如何破局", heat: "241万" }, { rank: 5, title: "肠道菌群研究最新进展", heat: "198万" }],
  weixin:      [{ rank: 1, title: "国务院数字经济条例全文解读", heat: "热" }, { rank: 2, title: "防溺水安全指南家长必看", heat: "热" }, { rank: 3, title: "立秋养生这几件事要注意", heat: "热" }, { rank: 4, title: "长江防汛最新进展", heat: "热" }, { rank: 5, title: "AI辅助教学进入中小学", heat: "热" }],
  baidu:       [{ rank: 1, title: "数字经济促进条例", heat: "698万" }, { rank: 2, title: "世界技能大赛2024", heat: "512万" }, { rank: 3, title: "长江洪水预警", heat: "476万" }, { rank: 4, title: "美联储最新决议", heat: "389万" }, { rank: 5, title: "立秋养生食谱", heat: "312万" }],
  toutiao:     [{ rank: 1, title: "年轻人媒体信任度跌至新低", heat: "234万" }, { rank: 2, title: "职业教育迎来政策红利", heat: "198万" }, { rank: 3, title: "肠道健康与免疫力关联研究", heat: "167万" }, { rank: 4, title: "城市绿化碳汇经济", heat: "143万" }, { rank: 5, title: "骑手权益保障新规", heat: "121万" }],
  xiaohongshu: [{ rank: 1, title: "立秋换季护肤必备", heat: "87万" }, { rank: 2, title: "城市徒步打卡地图", heat: "76万" }, { rank: 3, title: "肠道健康饮食记录", heat: "65万" }, { rank: 4, title: "七夕礼物清单", heat: "54万" }, { rank: 5, title: "在家做发酵食品攻略", heat: "43万" }],
  kuaishou:    [{ rank: 1, title: "农村骑手日记", heat: "4300万" }, { rank: 2, title: "家乡非遗技艺展示", heat: "3100万" }, { rank: 3, title: "防溺水安全挑战", heat: "2800万" }, { rank: 4, title: "职校生技能大赛备战", heat: "2200万" }, { rank: 5, title: "农村创业记", heat: "1900万" }],
  bilibili:    [{ rank: 1, title: "世界技能大赛全程回顾", heat: "860万" }, { rank: 2, title: "数字经济政策深度解读", heat: "720万" }, { rank: 3, title: "媒体信任危机纪录片", heat: "640万" }, { rank: 4, title: "肠道微生物科普动画", heat: "580万" }, { rank: 5, title: "城市生态修复全过程", heat: "490万" }],
  xueqiu:      [{ rank: 1, title: "美联储维持利率对A股影响", heat: "数据" }, { rank: 2, title: "数字经济板块投资机会", heat: "数据" }, { rank: 3, title: "绿色碳汇概念股梳理", heat: "数据" }, { rank: 4, title: "平台经济新规对外卖股的影响", heat: "数据" }, { rank: 5, title: "科技板块三季度预期", heat: "数据" }],
};

function SocialTrendsPage({ activePlatform, setActivePlatform }: { activePlatform: string; setActivePlatform: (id: string) => void }) {
  const current = platforms.find((p) => p.id === activePlatform) ?? platforms[0];
  const items = platformHotItems[activePlatform] ?? platformHotItems[platforms[0].id];

  return (
    <div className="flex gap-4 h-full">
      {/* Platform list sidebar */}
      <div className="w-44 flex-shrink-0 bg-white rounded-xl border border-border overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="text-xs font-semibold text-foreground">综合榜单</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">多平台热搜聚合</div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
          {platforms.map((p) => (
            <button key={p.id} onClick={() => setActivePlatform(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${activePlatform === p.id ? "bg-blue-50 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: p.color }}>{p.icon}</span>
              <span className="flex-1 text-left truncate">{p.name}</span>
              <span className="text-[10px] text-muted-foreground">{p.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hot items list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: current.color }}>{current.icon}</span>
          <span className="text-sm font-semibold text-foreground">{current.name}</span>
          <span className="text-xs text-muted-foreground ml-1">实时热榜</span>
          <button className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><RefreshCw size={12} /> 刷新</button>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.rank} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/30 hover:shadow-sm transition-all group">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.rank <= 3 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{item.rank}</span>
              <span className="flex-1 text-sm text-foreground group-hover:text-primary transition-colors">{item.title}</span>
              <span className="text-xs text-orange-400 flex items-center gap-0.5 flex-shrink-0"><TrendingUp size={11} />{item.heat}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary hover:text-white transition-colors">去创作</button>
                <button className="text-[11px] bg-muted text-muted-foreground px-2 py-1 rounded-lg hover:bg-primary hover:text-white transition-colors">AI分析</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Topic Ideas Tab ───────────────────────────────────────────────────────────

type TopicIdea = {
  id: number;
  category: string;
  title: string;
  points: string[];
  sourceLabel: string;
  sourceSub?: string;
  time: string;
  starred?: boolean;
};

const topicIdeas: TopicIdea[] = [
  {
    id: 1, category: "hot",
    title: "为什么互联网在追 DeepSeek「觉醒」？国产大模型时代的生死之战解析",
    points: [
      "DeepSeek连续两周登顶各平台热搜，但多数讨论停留在「厉害了」层面",
      "技术突破背后：万亿参数训练成本暴降90%意味着什么",
      "国产AI从跟随者到挑战者，这场转变对普通人意味着什么",
    ],
    sourceLabel: "为什么我会关注 DeepSeek", sourceSub: "「相关」", time: "2小时前",
  },
  {
    id: 2, category: "hot",
    title: "近在 DeepSeek「觉醒」，大模型战场上的「淘汰赛」开始了",
    points: [
      "百亿参数量级的大模型创业公司正在经历新一轮洗牌",
      "头部效应加剧：前三名吃掉85%算力资源和人才",
      "中小AI公司的三条出路：垂直、工具化、被收购",
    ],
    sourceLabel: "为什么我会关注 DeepSeek", sourceSub: "「相关」", time: "3小时前",
  },
  {
    id: 3, category: "ai",
    title: "为什么越来越多年轻人把周末塞满？揭秘都市饮食文化现象",
    points: [
      "「特种兵式旅游」向餐饮蔓延：一天打卡15家餐厅的Z世代",
      "情绪消费与仪式感：为什么年轻人愿意为「氛围」付溢价",
      "数据：周末餐饮消费同比增长38%，工作日反而下滑",
    ],
    sourceLabel: "为什么该视频爆了？", time: "今天",
  },
  {
    id: 4, category: "ai",
    title: "从互联网精神到日常饮食的餐厅文化理解，甲骨文的崛起路径",
    points: [
      "互联网大厂食堂文化输出：从内部福利到城市消费新地标",
      "企业美食IP的商业逻辑：免费流量与品牌溢价的双向奔赴",
      "案例：阿里、腾讯、字节的食堂开放日如何成为媒体素材富矿",
    ],
    sourceLabel: "为什么我会关注 DeepSeek", sourceSub: "「相关」", time: "昨天",
  },
  {
    id: 5, category: "hot",
    title: "高房贷成就英雄还是让人窒息？为什么那么多人仍在买",
    points: [
      "月供占收入60%仍有人咬牙入市：刚需心理与资产焦虑双重驱动",
      "「上车」执念背后：中国家庭财富配置结构的历史惯性",
      "新一代置业者的真实画像：杠杆、焦虑与沉默的代价",
    ],
    sourceLabel: "为什么该话题火了？", time: "2天前",
  },
  {
    id: 6, category: "mine",
    title: "法定二代选择上班出路，机构在外面如何实现平稳过渡？",
    points: [
      "「富二代」入职职场的真实生存状态：低调打工还是暗流涌动",
      "家族企业传承困境：职业经理人vs子承父业的博弈",
      "代际价值观断层：Z世代创业者如何定义「成功」",
    ],
    sourceLabel: "为什么我会关注此话题", time: "3天前", starred: true,
  },
  {
    id: 7, category: "ai",
    title: "《通勤》拍摄：记录与艺术如何实现知识产权实践互动？",
    points: [
      "纪录片版权「灰色地带」：街拍、肖像权与公共空间边界",
      "短视频时代的素材使用困境：合理引用还是侵权盗用",
      "媒体机构如何建立版权合规体系——操作手册与案例解析",
    ],
    sourceLabel: "为什么该视频爆了？", time: "今天",
  },
  {
    id: 8, category: "hot",
    title: "2026年流量密码已经改写下？要是你精准发现话题还是没有追到？",
    points: [
      "算法迭代下平台流量规则全面变化：情绪价值>信息价值",
      "「反常识」选题正在成为流量密码：五个爆款案例解析",
      "内容创作者的生存焦虑：追热点还是深耕人设，哪条路更长久",
    ],
    sourceLabel: "为什么该视频爆了？", time: "4小时前",
  },
  {
    id: 9, category: "collab",
    title: "临近假期为什么旅行计划总是没法实现？看看是什么原因",
    points: [
      "「计划脑」与「执行脑」的神经科学解读：为什么意志力总在关键时刻失效",
      "旅游平台数据：收藏夹里的目的地87%永远不会被预订",
      "解决方案不是更努力，而是重新设计你的决策路径",
    ],
    sourceLabel: "为什么我会关注此话题", time: "5小时前",
  },
  {
    id: 10, category: "mine",
    title: "组织为什么越大反而越慢？大公司病的根源与解法",
    points: [
      "从字节到阿里的组织变革案例：扁平化为什么总是失败",
      "会议文化、向上管理、KPI内卷——大公司病的三大病灶",
      "小团队高效的秘密：亚马逊「两个披萨」原则背后的管理哲学",
    ],
    sourceLabel: "为什么我会关注此话题", time: "6小时前", starred: true,
  },
];

function TopicIdeasTab() {
  const [generatorMode, setGeneratorMode] = useState<"industry" | "hot">("industry");
  const [topicBrief, setTopicBrief] = useState("");
  const [topicModel, setTopicModel] = useState("华生智媒");

  const filtered = topicIdeas;

  return (
    <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
      {/* Topic generator */}
      <div className="w-80 flex-shrink-0 bg-white border border-border rounded-xl p-4 flex flex-col min-h-0">
        <p className="text-xs font-medium text-muted-foreground mb-3">话题生成器</p>
        <div className="space-y-2">
          <button
            onClick={() => setGeneratorMode("industry")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              generatorMode === "industry" ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/20"
            }`}
          >
            <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <BarChart2 size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">我的行业</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">媒体传播 · AI内容生产</span>
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => setGeneratorMode("hot")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              generatorMode === "hot" ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/20"
            }`}
          >
            <span className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
              <Flame size={16} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-foreground">热点融合</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">结合实时热点生成话题</span>
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-[220px] border border-border rounded-xl mt-3 flex flex-col overflow-hidden focus-within:border-primary/40">
          <textarea
            value={topicBrief}
            onChange={(event) => setTopicBrief(event.target.value)}
            placeholder="补充话题描述，生成结果更容易击中你的心巴～"
            className="flex-1 min-h-0 resize-none bg-white px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="px-3 py-2.5 border-t border-border flex items-center">
            <button
              onClick={() => setTopicBrief("请结合近期行业热点，从用户关切、传播价值和差异化报道角度生成话题创意。")}
              className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700"
            >
              <Sparkles size={13} /> AI帮写
            </button>
            <button className="ml-auto w-6 h-6 rounded-full border border-foreground/60 flex items-center justify-center text-foreground hover:border-primary hover:text-primary">
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 py-3">
          <span className="text-xs text-muted-foreground">语言大模型</span>
          <select
            value={topicModel}
            onChange={(event) => setTopicModel(event.target.value)}
            className="ml-auto bg-transparent text-xs text-foreground outline-none cursor-pointer"
          >
            <option>华生智媒</option>
            <option>DeepSeek</option>
            <option>通义千问</option>
          </select>
        </div>
        <button
          disabled={!topicBrief.trim()}
          className="w-full bg-primary text-white text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          开始生成
        </button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          {generatorMode === "industry" ? "将根据行业偏好生成创意" : "将结合当前实时热点生成创意"}
        </p>
      </div>

      {/* Main 2-column grid */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 2-col idea cards */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-2 gap-3 pb-4">
            {filtered.map((idea) => (
              <div key={idea.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">
                    {idea.title}
                  </h3>
                  {idea.starred && <Star size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />}
                </div>
                <ul className="space-y-1 mb-3">
                  {idea.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
                      <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold mt-0.5">{i + 1}</span>
                      <span className="line-clamp-2">{pt}</span>
                    </li>
                  ))}
                </ul>
                {/* Source tag + time */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 truncate max-w-[70%]">
                    <Lightbulb size={9} />
                    {idea.sourceLabel}{idea.sourceSub && <span className="text-amber-500">{idea.sourceSub}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">{idea.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Topic Saved Tab ────────────────────────────────────────────────────────────

function TopicSavedTab() {
  const saved = topicIdeas.filter((i) => i.starred);
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      {saved.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-3">
          <Bookmark size={32} className="opacity-20" />
          <p className="text-sm">暂无收藏的话题</p>
          <p className="text-xs opacity-60">在「话题创意」中点击星标收藏感兴趣的创意</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-4">
          {saved.map((idea) => (
            <div key={idea.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">{idea.title}</h3>
                <Star size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />
              </div>
              <ul className="space-y-1 mb-3">
                {idea.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold mt-0.5">{i + 1}</span>
                    <span className="line-clamp-2">{pt}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Lightbulb size={9} /> {idea.sourceLabel}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto">{idea.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subscription Modal ────────────────────────────────────────────────────────

const TRACKS = [
  "科技","社会","教育","汽车","房产","游戏",
  "娱乐","旅游","职场","财经","科学","情感",
  "育儿","三农","宠物","健康",
];

const PLATFORMS = [
  { id: "douyin",   label: "抖音",   color: "bg-slate-900", textColor: "text-white" },
  { id: "kuaishou", label: "快手",   color: "bg-orange-500", textColor: "text-white" },
  { id: "weibo",    label: "微博",   color: "bg-red-500",   textColor: "text-white" },
  { id: "weixin",   label: "微信",   color: "bg-green-500", textColor: "text-white" },
  { id: "toutiao",  label: "头条",   color: "bg-red-600",   textColor: "text-white" },
  { id: "bilibili", label: "哔哩哔哩", color: "bg-blue-400", textColor: "text-white" },
];

const MOCK_ACCOUNTS: Record<string, { id: string; name: string; desc: string; followers: string }[]> = {
  douyin: [
    { id: "d1", name: "@央视新闻",    desc: "央视官方新闻账号",    followers: "1.2亿" },
    { id: "d2", name: "@人民日报",    desc: "权威党媒融媒体平台",  followers: "8900万" },
    { id: "d3", name: "@科技狐",      desc: "科技数码深度评测",    followers: "3200万" },
    { id: "d4", name: "@老爸评测",    desc: "消费品安全检测",      followers: "2800万" },
    { id: "d5", name: "@罗翔说刑法",  desc: "刑法科普与法律解读",  followers: "2100万" },
  ],
  kuaishou: [
    { id: "k1", name: "@快手新闻",    desc: "快手官方资讯平台",    followers: "6500万" },
    { id: "k2", name: "@农村四哥",    desc: "三农生活记录",        followers: "4100万" },
    { id: "k3", name: "@牛人解说",    desc: "热门事件深度解说",    followers: "3300万" },
    { id: "k4", name: "@娱乐老王",    desc: "娱乐圈资讯速报",      followers: "2600万" },
  ],
  weibo: [
    { id: "w1", name: "@头条新闻",    desc: "微博热点新闻聚合",    followers: "7800万" },
    { id: "w2", name: "@中国新闻网",  desc: "国家级新闻媒体",      followers: "5400万" },
    { id: "w3", name: "@新浪科技",    desc: "科技行业动态追踪",    followers: "4700万" },
    { id: "w4", name: "@财经天下",    desc: "财经热点深度解读",    followers: "3100万" },
    { id: "w5", name: "@娱乐圈吃瓜",  desc: "明星娱乐资讯速报",    followers: "2900万" },
  ],
  weixin: [
    { id: "wx1", name: "人民日报",     desc: "每日要闻推送",        followers: "3500万" },
    { id: "wx2", name: "36氪",         desc: "创投科技深度报道",    followers: "1800万" },
    { id: "wx3", name: "虎嗅APP",      desc: "商业洞察与分析",      followers: "1500万" },
    { id: "wx4", name: "财新周刊",     desc: "深度财经调查报道",    followers: "1200万" },
    { id: "wx5", name: "新周刊",       desc: "社会热点深度特稿",    followers: "980万" },
  ],
  toutiao: [
    { id: "t1", name: "今日头条",      desc: "个性化资讯推荐",      followers: "9900万" },
    { id: "t2", name: "中国日报",      desc: "权威英文媒体",        followers: "4400万" },
    { id: "t3", name: "汽车之家",      desc: "汽车行业资讯评测",    followers: "3800万" },
    { id: "t4", name: "房天下",        desc: "房产市场动态",        followers: "2700万" },
  ],
  bilibili: [
    { id: "b1", name: "@影视飓风",     desc: "影视制作深度内容",    followers: "2400万" },
    { id: "b2", name: "@何同学",       desc: "科技产品创意评测",    followers: "1800万" },
    { id: "b3", name: "@老师好我叫何同学", desc: "科技创意短片",   followers: "1600万" },
    { id: "b4", name: "@半佛仙人",     desc: "财经社会深度解读",    followers: "1400万" },
    { id: "b5", name: "@回形针PaperClip", desc: "科学知识科普",   followers: "1300万" },
  ],
};

type SubscriptionSite = SourceOption & {
  category: string;
  region: string;
};

const SITE_CATEGORIES = [
  "气象局", "电力", "能源局", "地震台网", "供水", "燃气", "政府门户", "部委官网",
  "新闻办发布会", "统计局（CPI/GDP）", "央行", "证监会", "海关", "外汇", "交易所",
  "公司官网", "应急管理", "公安", "消防", "卫健委 / 疾控", "房管局", "招考 / 教育",
  "社保", "医院", "人才招聘网", "行业协会", "论坛",
];

const SITE_REGIONS = ["全国", "北京市", "上海市", "广东省", "浙江省"];

const SUBSCRIPTION_SITES: SubscriptionSite[] = [
  { id: "site-cma", name: "中国气象局", desc: "天气预警与气象信息", category: "气象局", region: "全国" },
  { id: "site-bj-weather", name: "北京市气象局", desc: "北京天气预警与实况", category: "气象局", region: "北京市" },
  { id: "site-state-grid", name: "国家电网", desc: "供电服务与运行信息", category: "电力", region: "全国" },
  { id: "site-bj-power", name: "国网北京电力", desc: "北京停电公告与供电服务", category: "电力", region: "北京市" },
  { id: "site-nea", name: "国家能源局", desc: "能源政策与行业数据", category: "能源局", region: "全国" },
  { id: "site-ceic", name: "中国地震台网", desc: "地震速报与监测信息", category: "地震台网", region: "全国" },
  { id: "site-bj-water", name: "北京市自来水集团", desc: "供水公告与服务信息", category: "供水", region: "北京市" },
  { id: "site-sh-water", name: "上海城投水务", desc: "上海供水服务与公告", category: "供水", region: "上海市" },
  { id: "site-bj-gas", name: "北京燃气集团", desc: "燃气服务与安全公告", category: "燃气", region: "北京市" },
  { id: "site-gd-gas", name: "广东燃气协会", desc: "广东燃气行业信息", category: "燃气", region: "广东省" },
  { id: "site-gov", name: "中国政府网", desc: "国务院政务与政策发布", category: "政府门户", region: "全国" },
  { id: "site-bj-gov", name: "首都之窗", desc: "北京市政府门户网站", category: "政府门户", region: "北京市" },
  { id: "site-sh-gov", name: "上海市人民政府", desc: "上海政务信息与公告", category: "政府门户", region: "上海市" },
  { id: "site-miit", name: "工业和信息化部", desc: "工业与信息化政策发布", category: "部委官网", region: "全国" },
  { id: "site-mof", name: "财政部", desc: "财政政策与预算信息", category: "部委官网", region: "全国" },
  { id: "site-scio", name: "国务院新闻办公室", desc: "国新办新闻发布会信息", category: "新闻办发布会", region: "全国" },
  { id: "site-bj-scio", name: "北京市政府新闻办", desc: "北京新闻发布会信息", category: "新闻办发布会", region: "北京市" },
  { id: "site-stats", name: "国家统计局", desc: "CPI、GDP及宏观统计数据", category: "统计局（CPI/GDP）", region: "全国" },
  { id: "site-bj-stats", name: "北京市统计局", desc: "北京经济社会统计数据", category: "统计局（CPI/GDP）", region: "北京市" },
  { id: "site-pbc", name: "中国人民银行", desc: "货币政策与金融数据", category: "央行", region: "全国" },
  { id: "site-csrc", name: "中国证监会", desc: "资本市场监管信息", category: "证监会", region: "全国" },
  { id: "site-customs", name: "海关总署", desc: "进出口统计与海关公告", category: "海关", region: "全国" },
  { id: "site-safe", name: "国家外汇管理局", desc: "外汇政策与跨境资金数据", category: "外汇", region: "全国" },
  { id: "site-sse", name: "上海证券交易所", desc: "上市公司公告与市场数据", category: "交易所", region: "上海市" },
  { id: "site-szse", name: "深圳证券交易所", desc: "深市公告与交易数据", category: "交易所", region: "广东省" },
  { id: "site-bse", name: "北京证券交易所", desc: "北交所公告与市场数据", category: "交易所", region: "北京市" },
  { id: "site-sinopec", name: "中国石化官网", desc: "公司公告与经营动态", category: "公司官网", region: "全国" },
  { id: "site-bj-emergency", name: "北京市应急管理局", desc: "突发事件与安全生产信息", category: "应急管理", region: "北京市" },
  { id: "site-gd-emergency", name: "广东省应急管理厅", desc: "广东应急与预警信息", category: "应急管理", region: "广东省" },
  { id: "site-bj-police", name: "北京市公安局", desc: "警情通报与政务服务", category: "公安", region: "北京市" },
  { id: "site-bj-fire", name: "北京消防救援总队", desc: "消防安全与救援信息", category: "消防", region: "北京市" },
  { id: "site-nhc", name: "国家卫生健康委", desc: "卫生健康政策与通报", category: "卫健委 / 疾控", region: "全国" },
  { id: "site-bj-cdc", name: "北京市疾病预防控制中心", desc: "疾病监测与健康提示", category: "卫健委 / 疾控", region: "北京市" },
  { id: "site-bj-housing", name: "北京市住房和城乡建设委员会", desc: "房地产与住房管理信息", category: "房管局", region: "北京市" },
  { id: "site-bjee", name: "北京教育考试院", desc: "招考政策与考试公告", category: "招考 / 教育", region: "北京市" },
  { id: "site-moe", name: "教育部", desc: "国家教育政策与公告", category: "招考 / 教育", region: "全国" },
  { id: "site-bj-hrss", name: "北京市人力资源和社会保障局", desc: "社保政策与办事信息", category: "社保", region: "北京市" },
  { id: "site-pumch", name: "北京协和医院", desc: "医疗服务与医院公告", category: "医院", region: "北京市" },
  { id: "site-bj-jobs", name: "北京人才工作网", desc: "人才政策与招聘信息", category: "人才招聘网", region: "北京市" },
  { id: "site-china-jobs", name: "中国公共招聘网", desc: "全国公共招聘信息", category: "人才招聘网", region: "全国" },
  { id: "site-isc", name: "中国互联网协会", desc: "互联网行业动态与规范", category: "行业协会", region: "全国" },
  { id: "site-cap", name: "中国汽车流通协会", desc: "汽车行业数据与报告", category: "行业协会", region: "全国" },
  { id: "site-qiangguo", name: "强国论坛", desc: "时政与社会公共讨论", category: "论坛", region: "全国" },
  { id: "site-sh-forum", name: "上海城市论坛", desc: "上海城市生活讨论", category: "论坛", region: "上海市" },
];

const SUBSCRIPTION_REGION_TREE: Record<string, Record<string, string[]>> = {
  全国: { 全国: ["全部区域"] },
  北京市: { 北京市: ["全市", "东城区", "西城区", "朝阳区", "海淀区", "丰台区", "石景山区", "通州区", "昌平区", "大兴区"] },
  上海市: { 上海市: ["全市", "黄浦区", "徐汇区", "长宁区", "静安区", "浦东新区", "闵行区", "宝山区", "嘉定区"] },
  天津市: { 天津市: ["全市", "和平区", "河东区", "河西区", "南开区", "滨海新区", "西青区"] },
  重庆市: { 重庆市: ["全市", "渝中区", "江北区", "南岸区", "沙坪坝区", "九龙坡区", "两江新区"] },
  广东省: {
    广州市: ["全市", "越秀区", "天河区", "海珠区", "白云区", "番禺区"],
    深圳市: ["全市", "福田区", "南山区", "罗湖区", "宝安区", "龙岗区"],
    东莞市: ["全市", "南城街道", "东城街道", "松山湖", "虎门镇"],
  },
  浙江省: {
    杭州市: ["全市", "上城区", "拱墅区", "西湖区", "滨江区", "余杭区"],
    宁波市: ["全市", "海曙区", "江北区", "鄞州区", "镇海区"],
  },
  江苏省: {
    南京市: ["全市", "玄武区", "秦淮区", "建邺区", "鼓楼区", "江宁区"],
    苏州市: ["全市", "姑苏区", "吴中区", "相城区", "工业园区"],
  },
  山东省: { 济南市: ["全市", "历下区", "市中区", "槐荫区", "历城区"], 青岛市: ["全市", "市南区", "市北区", "崂山区", "黄岛区"] },
  河南省: { 郑州市: ["全市", "中原区", "二七区", "金水区", "郑东新区"], 洛阳市: ["全市", "老城区", "洛龙区", "涧西区"] },
  四川省: { 成都市: ["全市", "锦江区", "青羊区", "武侯区", "成华区", "高新区"], 绵阳市: ["全市", "涪城区", "游仙区"] },
  湖北省: { 武汉市: ["全市", "江岸区", "武昌区", "洪山区", "汉阳区", "东湖高新区"], 宜昌市: ["全市", "西陵区", "伍家岗区"] },
  福建省: { 福州市: ["全市", "鼓楼区", "台江区", "仓山区"], 厦门市: ["全市", "思明区", "湖里区", "集美区"] },
  陕西省: { 西安市: ["全市", "新城区", "碑林区", "雁塔区", "未央区", "高新区"] },
  河北省: { 石家庄市: ["全市", "长安区", "桥西区", "新华区", "裕华区"], 雄安新区: ["全区", "雄县", "容城县", "安新县"] },
  香港特别行政区: {
    香港岛: ["全区", "中西区", "湾仔区", "东区", "南区"],
    九龙: ["全区", "油尖旺区", "深水埗区", "九龙城区", "观塘区"],
    新界: ["全区", "沙田区", "屯门区", "元朗区", "西贡区"],
  },
  澳门特别行政区: {
    澳门半岛: ["全区", "花地玛堂区", "圣安多尼堂区", "大堂区"],
    离岛: ["全区", "氹仔", "路环"],
  },
  台湾省: {
    台北市: ["全市", "中正区", "大安区", "信义区", "士林区"],
    新北市: ["全市", "板桥区", "新店区", "淡水区"],
    高雄市: ["全市", "苓雅区", "左营区", "三民区"],
    台中市: ["全市", "西屯区", "北屯区", "南屯区"],
  },
};

function SubscribeModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"tracks" | "accounts" | "sites" | "keywords" | "regions">("tracks");
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [activePlatform, setActivePlatform] = useState("douyin");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [siteSearch, setSiteSearch] = useState("");
  const [siteCategory, setSiteCategory] = useState("all");
  const [siteRegion, setSiteRegion] = useState("all");
  const [keywords, setKeywords] = useState<string[]>(["人工智能", "媒体融合", "北京热点"]);
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set(["北京市 · 全市"]));
  const [regionProvince, setRegionProvince] = useState("北京市");
  const [regionCity, setRegionCity] = useState("北京市");
  const [regionDistrict, setRegionDistrict] = useState("全市");

  const toggleTrack = (t: string) =>
    setSelectedTracks((prev) => { const s = new Set(prev); s.has(t) ? s.delete(t) : s.add(t); return s; });

  const toggleAccount = (id: string) =>
    setSelectedAccounts((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSite = (id: string) =>
    setSelectedSites((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const addRegion = () => {
    const label =
      regionProvince === "全国"
        ? "全国"
        : regionProvince === regionCity
          ? `${regionProvince} · ${regionDistrict}`
          : `${regionProvince} · ${regionCity} · ${regionDistrict}`;
    setSelectedRegions((prev) => new Set(prev).add(label));
  };
  const addKeyword = () => {
    const keyword = keywordInput.trim();
    if (!keyword || keywords.includes(keyword)) return;
    setKeywords((current) => [...current, keyword]);
    setKeywordInput("");
  };

  const accounts = (MOCK_ACCOUNTS[activePlatform] ?? []).filter(
    (a) => accountSearch === "" || a.name.includes(accountSearch) || a.desc.includes(accountSearch)
  );
  const sites = SUBSCRIPTION_SITES.filter(
    (site) =>
      (siteCategory === "all" || site.category === siteCategory) &&
      (siteRegion === "all" || site.region === siteRegion) &&
      (siteSearch === "" || site.name.includes(siteSearch) || site.desc.includes(siteSearch))
  );

  const sections = [
    { id: "tracks" as const, label: "赛道订阅", icon: <Grid3x3 size={15} />, count: selectedTracks.size },
    { id: "accounts" as const, label: "账号订阅", icon: <Users size={15} />, count: selectedAccounts.size },
    { id: "sites" as const, label: "网站订阅", icon: <Globe size={15} />, count: selectedSites.size },
    { id: "keywords" as const, label: "关键词订阅", icon: <Hash size={15} />, count: keywords.length },
    { id: "regions" as const, label: "地域订阅", icon: <MapPin size={15} />, count: selectedRegions.size },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[760px] max-h-[92vh] mx-4 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-6 py-5 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">订阅设置</h2>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-48 flex-shrink-0 bg-muted/50 border-r border-border p-3 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                  activeTab === section.id ? "bg-white text-primary font-medium shadow-sm" : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                }`}
              >
                {section.icon}
                <span className="flex-1">{section.label}</span>
                <span className="text-[10px] min-w-5 h-5 px-1 rounded-full bg-primary/10 text-primary flex items-center justify-center">{section.count}</span>
                <ChevronRight size={12} className="opacity-40" />
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide p-6">
            {activeTab === "tracks" && (
              <div className="flex flex-wrap gap-2">
                {TRACKS.map((t) => {
                  const active = selectedTracks.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTrack(t)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                        active
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-muted text-muted-foreground border-transparent hover:border-primary/30 hover:text-primary"
                      }`}
                    >
                      {active && <span className="mr-1">✓</span>}{t}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "accounts" && (
              <div className="flex gap-4 h-full min-h-[420px]">
                <div className="flex-shrink-0 flex flex-col gap-1">
                  {PLATFORMS.map((p) => {
                    const count = (MOCK_ACCOUNTS[p.id] ?? []).filter((a) => selectedAccounts.has(a.id)).length;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActivePlatform(p.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                          activePlatform === p.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${p.color} ${p.textColor} flex-shrink-0`}>{p.label[0]}</span>
                        <span>{p.label}</span>
                        {count > 0 && <span className="ml-auto text-[10px] bg-primary text-white rounded-full px-1.5 py-0.5 font-semibold">{count}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-center bg-muted rounded-lg px-3 py-2 gap-2 mb-1">
                    <Search size={13} className="text-muted-foreground flex-shrink-0" />
                    <input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="搜索账号..." className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground" />
                    {accountSearch && <button onClick={() => setAccountSearch("")} className="text-muted-foreground"><X size={12} /></button>}
                  </div>
                  {accounts.map((acc) => {
                    const checked = selectedAccounts.has(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${checked ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/30"}`}
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${PLATFORMS.find((p) => p.id === activePlatform)?.color ?? "bg-muted"} ${PLATFORMS.find((p) => p.id === activePlatform)?.textColor ?? ""}`}>{acc.name.replace("@", "").slice(0, 1)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">{acc.name}</span>
                          <span className="block text-xs text-muted-foreground truncate">{acc.desc} · {acc.followers}粉丝</span>
                        </span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checked ? "bg-primary border-primary" : "border-border"}`}>
                          {checked && <Check size={11} className="text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "sites" && (
              <div>
                <div className="grid grid-cols-[1fr_130px_224px] gap-2 mb-4">
                  <select
                    value={siteCategory}
                    onChange={(e) => setSiteCategory(e.target.value)}
                    className="min-w-0 bg-white border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="all">全部网站分类</option>
                    {SITE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select
                    value={siteRegion}
                    onChange={(e) => setSiteRegion(e.target.value)}
                    className="bg-white border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="all">全部地域</option>
                    {SITE_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                  </select>
                  <div className="flex items-center bg-white border border-border rounded-lg px-3 py-2 gap-2 focus-within:border-primary">
                    <Search size={13} className="text-muted-foreground flex-shrink-0" />
                    <input value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)} placeholder="搜索网站站点..." className="flex-1 min-w-0 bg-transparent outline-none text-xs placeholder:text-muted-foreground" />
                    {siteSearch && <button onClick={() => setSiteSearch("")} className="text-muted-foreground"><X size={12} /></button>}
                  </div>
                </div>
                <div className="flex items-center text-[11px] text-muted-foreground mb-3">
                  <span>找到 {sites.length} 个网站</span>
                  {(siteCategory !== "all" || siteRegion !== "all" || siteSearch) && (
                    <button
                      onClick={() => { setSiteCategory("all"); setSiteRegion("all"); setSiteSearch(""); }}
                      className="ml-auto text-primary hover:underline"
                    >
                      清除筛选
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sites.map((site) => {
                    const checked = selectedSites.has(site.id);
                    return (
                      <button key={site.id} onClick={() => toggleSite(site.id)} className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${checked ? "bg-primary border-primary text-white" : "border-border text-transparent"}`}><Check size={12} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">{site.name}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">{site.desc}</span>
                          <span className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded">{site.category}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{site.region}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {sites.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Globe size={24} className="opacity-30 mb-2" />
                    <p className="text-xs">未找到符合分类和地域条件的网站</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "keywords" && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex-1 flex items-center bg-muted rounded-lg px-3 py-2.5 gap-2">
                    <Hash size={13} className="text-muted-foreground" />
                    <input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                      placeholder="输入需要持续关注的关键词"
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                    />
                  </div>
                  <button onClick={addKeyword} disabled={!keywordInput.trim()} className="text-xs text-primary border border-primary/20 px-4 py-2.5 rounded-lg hover:bg-primary/5 disabled:opacity-40">
                    <Plus size={12} className="inline mr-1" />添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <span key={keyword} className="inline-flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/10 px-3 py-2 rounded-full">
                      #{keyword}
                      <button onClick={() => setKeywords((current) => current.filter((item) => item !== keyword))} className="text-primary/50 hover:text-primary"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "regions" && (
              <div>
                <div className="border border-border rounded-xl p-4 mb-5">
                  <p className="text-xs font-medium text-foreground mb-3">选择订阅地域</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1.5">省／直辖市／特别行政区</label>
                      <select
                        value={regionProvince}
                        onChange={(e) => {
                          const province = e.target.value;
                          const firstCity = Object.keys(SUBSCRIPTION_REGION_TREE[province])[0];
                          setRegionProvince(province);
                          setRegionCity(firstCity);
                          setRegionDistrict(SUBSCRIPTION_REGION_TREE[province][firstCity][0]);
                        }}
                        className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
                      >
                        {Object.keys(SUBSCRIPTION_REGION_TREE).map((province) => <option key={province}>{province}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1.5">城市</label>
                      <select
                        value={regionCity}
                        onChange={(e) => {
                          const city = e.target.value;
                          setRegionCity(city);
                          setRegionDistrict(SUBSCRIPTION_REGION_TREE[regionProvince][city][0]);
                        }}
                        className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
                      >
                        {Object.keys(SUBSCRIPTION_REGION_TREE[regionProvince]).map((city) => <option key={city}>{city}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1.5">区／县</label>
                      <select
                        value={regionDistrict}
                        onChange={(e) => setRegionDistrict(e.target.value)}
                        className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
                      >
                        {SUBSCRIPTION_REGION_TREE[regionProvince][regionCity].map((district) => <option key={district}>{district}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={addRegion} className="w-full text-sm text-primary border border-primary/20 rounded-lg py-2.5 hover:bg-primary/5 transition-colors">
                    <Plus size={13} className="inline mr-1.5" />添加地域订阅
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-medium text-foreground">已订阅地域</p>
                    <span className="text-[11px] text-muted-foreground">{selectedRegions.size} 个</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedRegions).map((region) => (
                      <span key={region} className="inline-flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/10 px-3 py-2 rounded-full">
                        <MapPin size={12} />{region}
                        <button
                          onClick={() => setSelectedRegions((current) => {
                            const next = new Set(current);
                            next.delete(region);
                            return next;
                          })}
                          className="text-primary/50 hover:text-primary"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {selectedRegions.size === 0 && (
                    <p className="text-xs text-muted-foreground py-8 text-center">暂未添加地域订阅</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="ml-auto text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors">
            取消
          </button>
          <button onClick={onClose} className="text-sm bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary/90 font-medium transition-colors">
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Viral Video Analysis ─────────────────────────────────────────────────────

type ViralVideo = {
  id: number | string;
  title: string;
  source: string;
  date: string;
  time: string;
  duration: string;
  cover: string;
  progress: "待拆解" | "进行中" | "已完成" | "拆解失败";
  analysis?: VideoContentAnalysis;
  analysisError?: string;
  videoUrl?: string;
  work?: VideoWork;
  platformSnapshot?: PlatformSnapshot;
  demoWork?: boolean;
};

const viralVideos: ViralVideo[] = [
  {
    id: 1,
    title: "城市消防安全月：高层建筑逃生的关键三分钟",
    source: "北京消防",
    date: "2026-11-06",
    time: "15:28:53",
    duration: "05:38",
    cover: "https://images.unsplash.com/photo-1774599730985-9e20bfe01403?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 2,
    title: "消防员实战演练：如何在浓烟环境中快速定位火源",
    source: "应急中国",
    date: "2026-11-06",
    time: "14:16:20",
    duration: "08:49",
    cover: "https://images.unsplash.com/photo-1571623693069-1b5b9faecfa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "进行中",
  },
  {
    id: 3,
    title: "企业复工安全第一课：这些隐患最容易被忽略",
    source: "安全生产观察",
    date: "2026-11-05",
    time: "18:02:37",
    duration: "10:10",
    cover: "https://images.unsplash.com/photo-1651672666659-b3af240c8afb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 4,
    title: "消防救援现场纪实：一场与时间赛跑的夜间行动",
    source: "城市现场",
    date: "2026-11-05",
    time: "17:02:36",
    duration: "04:35",
    cover: "https://images.unsplash.com/photo-1664347306472-cc848573b6a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 5,
    title: "一线员工安全意识提升培训：从真实案例看违规代价",
    source: "企业安全课堂",
    date: "2026-11-04",
    time: "17:02:23",
    duration: "10:00",
    cover: "https://images.unsplash.com/photo-1787504893045-30842aa9de96?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "进行中",
  },
  {
    id: 6,
    title: "四不伤害的24条安全提示，全员都应该掌握",
    source: "安全管理局",
    date: "2026-11-04",
    time: "17:02:22",
    duration: "03:08",
    cover: "https://images.unsplash.com/photo-1771804359059-381b2c9d2847?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 7,
    title: "办公楼消防安全隐患对照检查：五个高频问题",
    source: "消防宣传月",
    date: "2026-11-04",
    time: "17:02:20",
    duration: "04:25",
    cover: "https://images.unsplash.com/photo-1758177351717-86f81302530a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 8,
    title: "消防安全警示教育短片：请为生命让出通道",
    source: "平安北京",
    date: "2026-11-04",
    time: "17:02:18",
    duration: "04:40",
    cover: "https://images.unsplash.com/photo-1783408356221-4f94319c0e36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "进行中",
  },
  {
    id: 9,
    title: "行为安全管理培训：让安全成为每个人的工作习惯",
    source: "职场安全",
    date: "2026-11-03",
    time: "17:01:46",
    duration: "08:49",
    cover: "https://images.unsplash.com/photo-1664347306472-cc848573b6a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 10,
    title: "火场逃生别回头：消防员总结的六个保命动作",
    source: "应急科普",
    date: "2026-11-03",
    time: "17:01:46",
    duration: "10:18",
    cover: "https://images.unsplash.com/photo-1774599730985-9e20bfe01403?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 11,
    title: "常见消防安全隐患对照检查，看看你身边有没有",
    source: "安全小课堂",
    date: "2026-11-02",
    time: "17:01:42",
    duration: "04:25",
    cover: "https://images.unsplash.com/photo-1571623693069-1b5b9faecfa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
  {
    id: 12,
    title: "节后企业复工：全员收心与警示安全培训课",
    source: "企业管理观察",
    date: "2026-11-01",
    time: "17:01:42",
    duration: "12:37",
    cover: "https://images.unsplash.com/photo-1651672666659-b3af240c8afb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    progress: "已完成",
  },
];

const demoVideoWorks: VideoWork[] = [
  ...viralVideos.slice(0, 8).map((video, index): VideoWork => ({
    id: String(video.id), platform: "媒资库", title: video.title, account: video.source,
    publishedAt: `${video.date} ${video.time}`, duration: video.duration, cover: video.cover,
    library: index < 5 ? "personal" : "team", mine: index % 2 === 0,
  })),
  ...viralVideos.map((video, index): VideoWork => ({
    id: String(video.id), platform: ["抖音", "微博", "B站", "微信", "网站", "快手", "头条"][index % 7],
    title: video.title, account: video.source, publishedAt: `${video.date} ${video.time}`,
    duration: video.duration, cover: video.cover,
  })),
];

function ViralAnalysisDrawer({ video, onClose }: { video: ViralVideo; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rewriteResultRef = useRef<HTMLDivElement>(null);
  const [activeSegment, setActiveSegment] = useState(0);
  const [rewrite, setRewrite] = useState<{
    topic: string; audience: string; seconds: number; materials: string;
  } | null>(null);
  const canShowAnalysis = video.id === 1 || (video.demoWork && video.work?.id === "1" && video.work.platform === "抖音");
  const snapshot = video.work && video.platformSnapshot?.platform === video.work.platform && video.platformSnapshot.workId === video.work.id
    ? video.platformSnapshot : undefined;
  const assessment = snapshot && Object.values(snapshot.metrics).some((value) => typeof value === "number" && Number.isFinite(value))
    && typeof snapshot.viralAssessment?.isViral === "boolean" && snapshot.viralAssessment.basis?.trim()
    ? snapshot.viralAssessment : undefined;
  const [playbackMetadata, setPlaybackMetadata] = useState<{ seconds: number; width: number; height: number }>();
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const comments = snapshot?.comments;
  const hasPlatformWork = Boolean(video.work && !video.work.library);
  const metrics = [
    { label: "播放量", value: snapshot?.metrics.views, icon: Eye },
    { label: "收藏量", value: snapshot?.metrics.favorites, icon: Bookmark },
    { label: "评论量", value: snapshot?.metrics.comments, icon: MessageSquare },
    { label: "点赞量", value: snapshot?.metrics.likes, icon: Heart },
    { label: "转发量", value: snapshot?.metrics.shares, icon: Share2 },
  ];
  const technicalRows = [
    ["时长", "338s（横屏 1920×1080 / 30fps）"],
    ["镜头数", "58 个，开篇硬切点为 8s、25s、70s"],
    ["平均镜长", "5.83s，最长连续镜头 17.0s"],
    ["画面亮度", "均值 142，波动 96–181"],
    ["画面饱和度", "均值 21.4，低饱和"],
    ["音频", "RMS 均值 −18.6dB，示例检测到 2 处短静默"],
    ["视觉素材", "现场实拍 / 主持人口播 / 分屏对照 / 动作特写 / 清单字幕"],
  ];
  const genes = [
    ["具体承诺", "用「高层建筑」限定场景，用「三分钟」把逃生知识变成观众能马上理解的观看理由。"],
    ["对照举证", "同一楼道内对照错误和正确动作，再用近景标出差异，观众能快速看懂并记住。"],
    ["有用到值得转发", "用一份行动清单收尾，给观众一个收藏复查、转给家人的具体理由。"],
  ];
  const structure = [
    { title: "标题吸引力", details: [
      ["写法与承诺", "「场景＋数字＋关键动作」面向高层住户，承诺讲清紧急情况下该如何行动，场景和时间都具体。"],
      ["封面分工与兑现", "封面用现场画面交代紧迫性，标题说清观看收益。正片 00:08 给第一条判断，00:25 用实拍开始兑现。"],
      ["缺少原标题", "单独评审片内开场文案，检查是否点明对象、问题与观看收益。"],
    ] },
    { title: "画面语言", details: [
      ["景别、构图、运镜", "全景交代楼道位置，正面中景承接口播，动作切到近景和手部特写。分屏让两个动作在同一视线上对比，开头用推镜引向警戒线。"],
      ["字幕与 B-roll", "高对比短字幕突出动词，示范画面跟随口播出现，展示口播提到的动作和细节。"],
    ] },
    { title: "叙事节奏", details: [
      ["提问和第一条证据", "开头 8 秒内提出问题，00:08 给出第一条判断，00:25 通过动作对照给出第一条实拍证据。"],
      ["重复和标题呼应", "00:25 后口播与字幕同步重复关键动作。01:10 用逃生清单呼应标题承诺。"],
    ] },
    { title: "情绪调动", details: [
      ["情绪曲线", "00:00 危机场景引发紧张，00:08 反常识判断拉升悬念，00:25 实拍对照达到峰值，01:10 清单收束为安心和行动意愿。"],
    ] },
  ];
  const reusableStructure = video.analysis?.reusableStructure ?? ["结果先给", "同起点对比", "实拍举证", "一句话给行动建议"];
  const improvementTips = [
    "将结果预告前置到前3秒，进一步强化用户停留动机。",
    "压缩解释性旁白，增加现场同期声和人物反应镜头。",
    "中段补充一组错误与正确做法的强对比画面。",
    "结尾增加可执行清单，引导用户收藏和转发。",
  ];
  const rewriteSteps = !rewrite ? [] : video.analysis ? reusableStructure.map((step) =>
    `面向「${rewrite.audience}」，把「${step}」应用到「${rewrite.topic}」。从「${rewrite.materials}」挑选能支撑这一步的素材，缺少的内容列为待补。`
  ) : [
    `开场对「${rewrite.audience}」直接交代「${rewrite.topic}」的结果，把最有用的信息说在前面。`,
    `从同一个起点演示两种做法，用相同口径比较路线、耗时或结果。`,
    `从「${rewrite.materials}」挑出能证明差异的镜头，配上实测字幕。缺少证据的地方标记为待补拍。`,
    `用一句话告诉「${rewrite.audience}」下一步怎么做，把关键动作留在末屏。`,
  ];
  const rewriteRatios = video.analysis
    ? Array.from({ length: reusableStructure.length + 1 }, (_, index) => index / reusableStructure.length)
    : [0, 0.15, 0.45, 0.85, 1];
  const rewriteCuts = rewrite ? rewriteRatios.map((ratio) => Math.round(rewrite.seconds * ratio)) : [];

  const handleRewrite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const topic = String(form.get("topic")).trim();
    const audience = String(form.get("audience")).trim();
    const materials = String(form.get("materials")).trim();
    const seconds = Number(form.get("seconds"));
    if (!topic || !audience || !materials || !Number.isInteger(seconds) || seconds < Math.max(4, reusableStructure.length)) return;
    setRewrite({ topic, audience, materials, seconds });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (rewrite) rewriteResultRef.current?.scrollIntoView({ block: "nearest" });
  }, [rewrite]);

  const rewriteForm = <>
                <form onSubmit={handleRewrite} className="mt-3 space-y-3 rounded-xl border border-border p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">新选题
                      <input name="topic" required maxLength={80} placeholder="如医院停车指引" className="block w-full rounded-lg border border-border px-3 py-2" />
                    </label>
                    <label className="space-y-1 text-xs font-medium">受众
                      <input name="audience" required maxLength={80} placeholder="如首次开车来院的患者家属" className="block w-full rounded-lg border border-border px-3 py-2" />
                    </label>
                    <label className="space-y-1 text-xs font-medium">目标时长（秒）
                      <input name="seconds" type="number" required min={Math.max(4, reusableStructure.length)} step={1} placeholder="如 45" className="block w-full rounded-lg border border-border px-3 py-2" />
                    </label>
                  </div>
                  <label className="block space-y-1 text-xs font-medium">手头素材
                    <textarea name="materials" required maxLength={300} rows={2} placeholder="如东门入口实拍、停车场路牌、两条路线的计时画面" className="block w-full resize-y rounded-lg border border-border px-3 py-2" />
                  </label>
                  <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white hover:bg-primary/90">生成仿写提纲</button>
                </form>

                {rewrite && (
                  <div ref={rewriteResultRef} aria-live="polite" className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <p className="text-sm font-semibold">{rewrite.topic} · {rewrite.seconds} 秒提纲</p>
                    <ol className="mt-3 space-y-2.5">
                      {rewriteSteps.map((step, index) => (
                        <li key={index} className="text-xs leading-relaxed">
                          <span className="mr-2 font-medium tabular-nums text-primary">{rewriteCuts[index]}–{rewriteCuts[index + 1]}s</span>
                          <strong>{reusableStructure[index]}</strong><p className="mt-0.5 text-foreground/80">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
  </>;

  const downloadWord = (type: "analysis" | "strategy") => {
    const isAnalysis = type === "analysis";
    const title = isAnalysis ? "视频拆解分析报告" : "视频改进策略报告";
    const escapeHtml = (value: string) => value.replace(/[&<>]/g, (character) => (
      character === "&" ? "&amp;" : character === "<" ? "&lt;" : "&gt;"
    ));
    const describe = (label: string, value: string) => `<p><b>${label}</b> ${escapeHtml(value)}</p>`;
    const body = isAnalysis
      ? `<h2>技术参数分析</h2>${technicalRows.map(([label, value]) => describe(label, value)).join("")}
         <h2>短视频传播要素</h2>${genes.map(([label, value]) => describe(label, value)).join("")}
         <h2>视频分镜脚本</h2>${storyboards.map((item) => describe(item.time, item.action)).join("")}
         <h2>结构要素分析</h2>${structure.map((item) => `<h3>${item.title}</h3>${item.details.map(([label, value]) => describe(label, value)).join("")}`).join("")}`
      : `<h2>改进策略</h2><ol>${improvementTips.map((tip) => `<li>${tip}</li>`).join("")}</ol>
         <h2>仿写建议</h2><p>${reusableStructure.join(" → ")}</p>
         ${rewrite ? `<h3>${escapeHtml(rewrite.topic)} · ${rewrite.seconds} 秒</h3><ol>${rewriteSteps.map((step, index) => `<li>${rewriteCuts[index]}–${rewriteCuts[index + 1]}s ${escapeHtml(step)}</li>`).join("")}</ol>` : ""}`;
    const content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><h3>${escapeHtml(video.title)}</h3><p>演示分析以高层建筑逃生视频为样例。</p>${body}</body></html>`;
    const blob = new Blob(["\ufeff", content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${video.title}-${title}.doc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const storyboards = [
    {
      start: 0, end: 8, time: "00:00–00:08",
      action: "火场浓烟与消防车快速交替，镜头推近现场警戒线。",
      voiceover: "高层起火后，留给住户安全逃生的时间可能只有三分钟。",
      subtitle: "黄金三分钟，你真的会逃生吗？",
      sound: "警报声＋低频鼓点，前2秒音量快速增强。",
      purpose: "用危机场景制造强冲突，快速建立观看动机。",
    },
    {
      start: 8, end: 25, time: "00:08–00:25",
      action: "主持人走入楼道，依次指向防火门、疏散标识和消防栓。",
      voiceover: "多数人第一步就做错了：不是立刻向下跑，而是先判断烟气方向。",
      subtitle: "第一步：判断烟气方向",
      sound: "现场同期声降低，旁白清晰突出。",
      purpose: "抛出反常识知识点，建立内容专业度。",
    },
    {
      start: 25, end: 70, time: "00:25–01:10",
      action: "错误示范与正确动作左右分屏，关键动作使用手部特写。",
      voiceover: "低姿前进、关闭身后防火门，并用湿布保护口鼻。",
      subtitle: "低姿前进｜关闭防火门｜保护口鼻",
      sound: "节奏型鼓点配合动作切换，每个步骤加入提示音。",
      purpose: "通过对比和步骤化演示，提高信息理解与记忆效率。",
    },
    {
      start: 70, end: 95, time: "01:10–01:35",
      action: "画面回到安全区域，人物正对镜头总结并展示安全清单。",
      voiceover: "把这份清单转给家人，多一次准备，就多一分生的希望。",
      subtitle: "收藏清单，并转给你关心的人",
      sound: "音乐转为明亮，结尾保留两秒环境声。",
      purpose: "完成情绪释放，并通过实用清单推动收藏和转发。",
    },
  ];

  const seekToSegment = (start: number, index: number) => {
    setActiveSegment(index);
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = start;
    void player.play().catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/35 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute inset-y-0 right-0 w-full max-w-[90rem] xl:w-[92vw] bg-white shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <button onClick={onClose} aria-label="关闭拆解详情" className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{video.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">爆款智能拆解 · {video.source}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button onClick={() => downloadWord("analysis")} disabled={!canShowAnalysis} className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs text-primary bg-white border border-primary/25 px-3 py-2 rounded-lg hover:bg-primary/5">
              <FileText size={13} /> 导出分析报告
            </button>
            <button onClick={() => downloadWord("strategy")} disabled={!canShowAnalysis} className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90">
              <Download size={13} /> 导出改进策略报告
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto md:flex md:overflow-hidden">
          <div className="min-w-0 shrink-0 border-border bg-slate-50 md:w-1/2 md:overflow-y-auto md:border-r lg:w-[52%]">
            <div className="bg-[#3b82f680] p-5">
              <div className="aspect-video rounded-xl overflow-hidden relative flex items-center justify-center">
                <video ref={videoRef} controls poster={video.cover} src={video.videoUrl}
                  onError={() => setPlaybackFailed(true)}
                  onLoadedMetadata={(event) => {
                    const player = event.currentTarget;
                    if (Number.isFinite(player.duration)) setPlaybackMetadata({ seconds: player.duration, width: player.videoWidth, height: player.videoHeight });
                  }}
                  className="w-full h-full object-contain" />
                {!video.videoUrl && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <span className="w-14 h-14 rounded-full bg-black/55 text-white flex items-center justify-center"><Play size={23} fill="currentColor" /></span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-800">
                <p className="text-sm font-semibold text-slate-950">{video.title}</p>
                {canShowAnalysis && <span>当前分镜 {activeSegment + 1}/{storyboards.length}</span>}
              </div>
            </div>
            <div className="space-y-5 p-5">
              <section className="rounded-xl border border-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><BarChart2 size={15} className="text-primary" /> 视频传播数据</h3>
                  {hasPlatformWork && <span className="text-xs text-muted-foreground">{video.work?.platform}</span>}
                </div>
                <dl className="grid grid-cols-2 gap-3 border-b border-border pb-3 text-xs">
                  <div><dt className="text-muted-foreground">发布时间</dt><dd className="mt-1 font-medium tabular-nums">{snapshot?.publishedAt || (!video.demoWork ? video.work?.publishedAt : undefined) || "未获取"}</dd></div>
                  <div><dt className="text-muted-foreground">发布账号</dt><dd className="mt-1 font-medium">{snapshot?.account || (!video.demoWork ? video.work?.account : undefined) || "未获取"}</dd></div>
                </dl>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {metrics.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Icon size={12} />{label}</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums">{typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "未获取"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="rounded-xl border border-border bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} className="text-primary" /> 视频评论</h3>
                </div>
                {comments?.length ? (
                  <ul className="divide-y divide-border">
                    {comments.map((comment) => (
                      <li key={comment.id} className="py-3 last:pb-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-medium text-foreground">{comment.author}</span>
                          <span className="tabular-nums text-muted-foreground">{comment.date}</span>
                          {comment.likes != null && <span className="ml-auto flex items-center gap-1 text-muted-foreground"><Heart size={12} />{comment.likes}</span>}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{comment.text}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="py-3 text-xs text-muted-foreground">{comments ? "该作品暂无公开评论。" : hasPlatformWork ? "未获取当前作品的评论。" : "此视频暂无关联的平台评论。"}</p>}
              </section>
            </div>
          </div>

          <div className="min-w-0 flex-1 p-5 sm:p-6 md:overflow-y-auto">
            <section className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">爆款判断</h3>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] text-muted-foreground">
                  {assessment ? assessment.isViral ? "达到爆款基准" : "未达到爆款基准" : "暂无判断依据"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{assessment?.basis ?? "需同时取得当前作品的真实传播数据和可比基准。内容拆解可独立进行。"}</p>
            </section>
            {video.analysis ? (
              <div className="space-y-5">
                <section className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 text-sm font-semibold">技术参数分析</h3>
                  <dl className="divide-y divide-border">
                    {video.analysis.technical.map(({ label, value }, index) => <div key={index} className="grid grid-cols-[minmax(5rem,1fr)_3fr] gap-3 py-2 text-xs"><dt className="font-medium">{label}</dt><dd>{value}</dd></div>)}
                  </dl>
                </section>
                <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <h3 className="text-sm font-semibold">AI 拆解总结</h3>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6">{video.analysis.summary}</p>
                </section>
                <section className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 text-sm font-semibold">结构要素分析</h3>
                  <dl className="space-y-3 text-xs leading-6">
                    {video.analysis.structure.map(({ label, value }, index) => <div key={index}><dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{value}</dd></div>)}
                  </dl>
                </section>
                <section className="rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold">可复用结构</h3>
                  <p className="mt-2 text-xs leading-6">{reusableStructure.join(" → ")}</p>
                  <p className="mt-3 text-xs text-muted-foreground">填写新选题后生成仿写提纲初稿。</p>
                  {rewriteForm}
                </section>
              </div>
            ) : !canShowAnalysis ? (
              <section className="rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold">内容拆解</h3>
                {playbackMetadata && <dl className="mt-3 flex flex-wrap gap-5 rounded-lg bg-muted/40 p-3 text-xs">
                  <div><dt className="text-muted-foreground">视频时长</dt><dd className="mt-1 font-medium">{playbackMetadata.seconds.toFixed(2)} 秒</dd></div>
                  <div><dt className="text-muted-foreground">画面分辨率</dt><dd className="mt-1 font-medium">{playbackMetadata.width} × {playbackMetadata.height}</dd></div>
                </dl>}
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {video.analysisError ?? (video.progress === "进行中" ? "正在分析视频内容…"
                    : playbackFailed ? "当前视频无法播放，请检查视频文件或播放地址。"
                    : !video.videoUrl ? "当前作品未获取可播放的视频，暂无法读取视频内容。"
                    : "视频可以预览，完整内容拆解服务尚未配置。")}
                </p>
              </section>
            ) : <>
              <section className="mb-6">
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><Settings size={15} className="text-primary" /> 技术参数分析</h3>
                  <span className="text-xs text-muted-foreground">高层建筑逃生视频示例</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full table-fixed text-left text-xs leading-relaxed">
                    <thead className="bg-slate-50 text-foreground"><tr><th scope="col" className="w-[27%] px-3 py-2.5">项目</th><th scope="col" className="border-l border-border px-3 py-2.5">数值</th></tr></thead>
                    <tbody>
                      {technicalRows.map(([label, value]) => (
                        <tr key={label} className="border-t border-border">
                          <th scope="row" className="px-3 py-2 font-medium">{label}</th>
                          <td className="break-words border-l border-border px-3 py-2 tabular-nums text-foreground/80">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-primary" /> 短视频传播要素 · AI 拆解示例</h3>
                <p className="mb-3 text-xs font-medium leading-relaxed text-foreground">这条样例先让住户意识到风险，再用看得懂的动作对照给出答案，最后提供值得保存和转发的清单。</p>
                <dl className="space-y-2.5">
                  {genes.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[4.5rem_1fr] gap-2 text-xs leading-relaxed">
                      <dt className="font-semibold text-blue-800">{label}</dt>
                      <dd className="text-foreground/80">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="mb-7">
                <div className="flex items-center gap-2 mb-4">
                  <Film size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">视频分镜脚本</h3>
                </div>
                <div className="space-y-2">
                  {storyboards.map((item, index) => (
                    <button
                      key={item.time}
                      onClick={() => seekToSegment(item.start, index)}
                      className={`w-full flex gap-3 p-3 border rounded-xl text-left transition-all ${
                        activeSegment === index
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-muted/30 hover:border-primary/30 hover:bg-primary/[0.03]"
                      }`}
                    >
                      <div className="w-28 aspect-video rounded-lg overflow-hidden bg-foreground relative flex-shrink-0">
                        {video.cover ? (
                          <img
                            src={video.cover}
                            alt={`分镜 ${index + 1}`}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: `${20 + index * 20}% center` }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/60"><Film size={18} /></div>
                        )}
                        <span className="absolute inset-0 bg-black/15 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Play size={17} className="text-white" fill="currentColor" />
                        </span>
                        <span className="absolute left-1.5 bottom-1.5 text-[9px] text-white bg-black/65 px-1.5 py-0.5 rounded">{item.time}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-5 h-5 rounded-md text-[10px] flex items-center justify-center flex-shrink-0 ${
                            activeSegment === index ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                          }`}>{index + 1}</span>
                          <span className="text-xs font-semibold text-foreground">分镜 {index + 1}</span>
                          <span className="text-[10px] text-primary ml-auto">点击定位播放</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">画面动作</p>
                            <p className="text-[11px] text-foreground/80 leading-relaxed">{item.action}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">口播</p>
                            <p className="text-[11px] text-foreground/80 leading-relaxed">{item.voiceover}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">字幕</p>
                            <p className="text-[11px] text-foreground/80 leading-relaxed">{item.subtitle}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">声音</p>
                            <p className="text-[11px] text-foreground/80 leading-relaxed">{item.sound}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-muted-foreground mb-0.5">镜头作用</p>
                            <p className="text-[11px] text-foreground/80 leading-relaxed">{item.purpose}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-7">
                <h3 className="text-sm font-semibold text-foreground mb-4">结构要素分析</h3>
                <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                  {structure.map((item) => (
                    <article key={item.title} className="rounded-xl border border-border p-4">
                      <h4 className="mb-2.5 text-sm font-semibold">{item.title}</h4>
                      {item.title === "情绪调动" && (
                        <figure className="mb-3 rounded-lg bg-blue-50/60 px-3 py-2">
                          <svg viewBox="0 0 320 66" className="h-16 w-full" role="img" aria-label="情绪从紧张上升到悬念和峰值，最后回落为安心">
                            <path d="M8 56H312" stroke="#bfdbfe" fill="none" />
                            <path d="M8 44 Q38 43 55 30 T100 20 Q130 2 170 13 T250 27 Q285 31 312 48" stroke="#2563eb" strokeWidth="2.5" fill="none" />
                          </svg>
                          <figcaption className="flex justify-between gap-2 text-[11px] text-muted-foreground"><span>紧张</span><span>悬念</span><span>峰值</span><span>安心</span></figcaption>
                        </figure>
                      )}
                      <dl className="space-y-2 text-xs leading-relaxed">
                        {item.details.map(([label, value]) => (
                          <div key={label}>
                            <dt className="font-medium text-foreground">{label}</dt>
                            <dd className="mt-0.5 text-muted-foreground">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mb-7">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} className="text-violet-600" />
                  <h3 className="text-sm font-semibold text-foreground">视频改进策略</h3>
                </div>
                <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-4">
                  <ol className="space-y-2">
                    {improvementTips.map((item, index) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-foreground/80 leading-relaxed">
                        <span className="text-violet-600 font-semibold">{index + 1}.</span>{item}
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Pencil size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">仿写建议</h3>
                </div>
                <div className="rounded-xl border border-border bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-foreground">可复用结构</p>
                  <ol className="mt-2 flex flex-wrap gap-2">
                    {reusableStructure.map((step, index) => (
                      <li key={step} className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-foreground">
                        <span className="mr-1 text-primary">{index + 1}.</span>{step}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">迁移示例：地铁换乘视频先给更快路线，从同一出发点对照两条路线，再用实拍和计时举证。换成医院停车指引，就可以从同一院区入口对比停车路线，实拍分岔路牌，最后给出停车建议。</p>
                  <details className="mt-3 border-t border-border pt-3 text-xs">
                    <summary className="cursor-pointer font-medium text-primary">查看医院停车指引仿写示例</summary>
                    <ol className="mt-2 space-y-2 leading-relaxed text-foreground/80">
                      <li><strong>0–7s</strong> 「第一次开车来医院？进院前先看这一条，找到停车入口再导航。」</li>
                      <li><strong>7–20s</strong> 从同一个院区路口出发，分屏对照两条进场路线，用箭头标出各自的转弯点。</li>
                      <li><strong>20–38s</strong> 实拍路口、停车标识和入口，叠加两条路线的实测耗时，说明哪条适合当前情况。</li>
                      <li><strong>38–45s</strong> 「出发前把导航设为确认可用的停车场入口，到院后跟着停车标识走。」</li>
                    </ol>
                  </details>
                </div>

                {rewriteForm}
              </section>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

type SavedVideoTask = { id: ViralVideo["id"]; video: ViralVideo; file?: File };

function useViralVideoTasks() {
  const [videos, setVideos] = useState<ViralVideo[]>(viralVideos);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const analysisRequests = useRef(new Map<ViralVideo["id"], AbortController>());
  const localFiles = useRef(new Map<ViralVideo["id"], File>());
  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    const urls = objectUrls.current;
    const files = localFiles.current;
    const requests = analysisRequests.current;
    void readPreviewVideoTasks<SavedVideoTask>().then((saved) => {
      if (!active) return;
      const restored = saved.map(({ video, file }): ViralVideo => {
        const task = { ...video };
        if (file) {
          task.videoUrl = URL.createObjectURL(file);
          urls.add(task.videoUrl);
          files.set(task.id, file);
        }
        if (task.progress === "进行中") {
          task.progress = "拆解失败";
          task.analysisError = "上次拆解因预览关闭而中断，请重新导入视频。";
        }
        return task;
      });
      const restoredIds = new Set(restored.map((task) => task.id));
      restored.sort((left, right) => `${right.date} ${right.time}`.localeCompare(`${left.date} ${left.time}`));
      setVideos([...restored, ...viralVideos.filter((task) => !restoredIds.has(task.id))]);
    }).catch(() => {
      if (active) setStorageError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      files.clear();
      requests.forEach((controller) => controller.abort());
      requests.clear();
    };
  }, []);

  const persist = (task: ViralVideo) => {
    const file = localFiles.current.get(task.id);
    const video = file ? { ...task, videoUrl: undefined } : task;
    void savePreviewVideoTask({ id: task.id, video, file } as SavedVideoTask).catch(() => setStorageError(true));
  };

  const importVideos = (items: VideoImport[]) => {
    const now = new Date();
    const imported = items.map((item): ViralVideo => {
      const defaults = {
        date: newsroomDaysBefore(0, now),
        time: now.toLocaleTimeString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
        duration: "--:--",
        cover: "",
        progress: hasVideoAnalysisApi ? "进行中" as const : "待拆解" as const,
      };
      if (item.kind === "local") {
        const videoUrl = URL.createObjectURL(item.file);
        objectUrls.current.add(videoUrl);
        return { ...defaults, id: crypto.randomUUID(), title: item.file.name, source: "本地上传", videoUrl };
      }
      if (item.kind === "link") {
        const name = item.url.pathname.split("/").pop() || "链接视频";
        return { ...defaults, id: item.url.href, title: name, source: "视频链接", videoUrl: item.url.href };
      }
      const { work, snapshot, demo } = item;
      return {
        ...defaults,
        id: `${demo ? "demo" : "work"}:${workKey(work)}`,
        title: work.title,
        source: work.account || work.platform,
        duration: work.duration || defaults.duration,
        cover: work.cover || defaults.cover,
        videoUrl: work.videoUrl,
        work: item.kind === "library" ? undefined : work,
        platformSnapshot: snapshot,
        demoWork: demo,
        progress: demo && work.id === "1" && work.platform === "抖音" ? "已完成" : defaults.progress,
      };
    });
    const importedIds = new Set(imported.map((video) => video.id));
    imported.forEach((video, index) => {
      const item = items[index];
      if (item.kind === "local") localFiles.current.set(video.id, item.file);
      persist(video);
    });
    setVideos((current) => [...imported, ...current.filter((video) => !importedIds.has(video.id))]);
    imported.forEach((video, index) => {
      if (!hasVideoAnalysisApi || video.demoWork || video.progress !== "进行中") return;
      analysisRequests.current.get(video.id)?.abort();
      const controller = new AbortController();
      analysisRequests.current.set(video.id, controller);
      const update = (result: Partial<ViralVideo>) => {
        if (controller.signal.aborted) return;
        const updated = { ...video, ...result };
        setVideos((current) => current.map((entry) => entry.id === video.id ? updated : entry));
        persist(updated);
      };
      void analyzeVideo(items[index], controller.signal).then(
        (analysis) => update({ analysis, progress: "已完成" }),
        (error: unknown) => update({ progress: "拆解失败", analysisError: error instanceof Error ? error.message : "内容拆解失败。" }),
      ).finally(() => {
        if (analysisRequests.current.get(video.id) === controller) analysisRequests.current.delete(video.id);
      });
    });
  };
  return { videos, loading, storageError, importVideos };
}

function ViralAnalysisPage({ tasks }: { tasks: ReturnType<typeof useViralVideoTasks> }) {
  const { videos, loading, storageError, importVideos } = tasks;
  const [selectedVideoId, setSelectedVideoId] = useState<ViralVideo["id"] | null>(null);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const videoListRef = useRef<HTMLDivElement>(null);
  const userNickname = "小编";
  const timeOptions = [
    { id: "all", label: "全部时间" },
    { id: "today", label: "今日" },
    { id: "3days", label: "近3天" },
    { id: "week", label: "近一周" },
  ];

  const dateString = (date: Date) => date.toLocaleDateString("sv-SE");
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return dateString(date);
  };
  const demoDates: Record<string, string> = { today: "2026-11-06", "3days": "2026-11-04", week: "2026-10-31" };
  const currentDates: Record<string, string> = { today: daysAgo(0), "3days": daysAgo(2), week: daysAgo(6) };
  const filteredVideos = videos.filter((video) => {
    const matchKeyword = searchQuery === "" || video.title.includes(searchQuery) || video.source.includes(searchQuery);
    const dates = typeof video.id === "number" ? demoDates : currentDates;
    const matchTime = timeFilter === "all" || video.date >= dates[timeFilter];
    const matchStatus = statusFilter === "all" || video.progress === statusFilter;
    return matchKeyword && matchTime && matchStatus;
  });

  const paginatedVideos = filteredVideos.slice((page - 1) * pageSize, page * pageSize);

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    videoListRef.current?.scrollTo({ top: 0 });
  };

  const updateSearch = (query: string) => {
    setSearchQuery(query);
    changePage(1);
  };

  const onImport = (items: VideoImport[]) => {
    importVideos(items);
    setSearchQuery("");
    setTimeFilter("all");
    setStatusFilter("all");
    changePage(1);
  };

  return (
    <div className="flex flex-col h-full">
      {selectedVideo && <ViralAnalysisDrawer key={selectedVideo.id} video={selectedVideo} onClose={() => setSelectedVideoId(null)} />}
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
        {loading ? <p role="status" className="text-xs text-muted-foreground">正在读取本地任务…</p>
          : <ViralVideoUploadDialog demoWorks={demoVideoWorks} onImport={onImport} />}
        <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">
          <div className="w-full sm:w-56 flex items-center bg-white border border-border rounded-lg px-3 py-2 gap-2">
            <Search size={13} className="text-muted-foreground" />
            <input value={searchQuery} onChange={(event) => updateSearch(event.target.value)} placeholder="搜索视频..." className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-muted-foreground" />
            {searchQuery && <button onClick={() => updateSearch("")} className="text-muted-foreground"><X size={12} /></button>}
          </div>
          <div className="flex items-center gap-1 bg-white border border-border rounded-lg px-1 py-1">
            {timeOptions.map((option) => (
              <button key={option.id} onClick={() => { setTimeFilter(option.id); changePage(1); }} className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-md transition-all ${timeFilter === option.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <select
            aria-label="任务状态"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              changePage(1);
            }}
            className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="all">全部状态</option>
            <option value="待拆解">待拆解</option>
            <option value="进行中">进行中</option>
            <option value="拆解失败">拆解失败</option>
            <option value="已完成">已完成</option>
          </select>
        </div>
      </div>

      {storageError && <p role="status" className="mb-2 text-xs text-amber-700">浏览器任务存储不可用。新任务可在本次预览中查看，刷新后可能丢失。</p>}

      <div ref={videoListRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-4 gap-4 pb-4">
          {paginatedVideos.map((video) => (
            <button key={video.id} onClick={() => setSelectedVideoId(video.id)} className="bg-white border border-border rounded-xl overflow-hidden text-left hover:border-primary/30 hover:shadow-md transition-all group">
              <div className="aspect-video bg-foreground relative overflow-hidden">
                {video.cover ? (
                  <img src={video.cover} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-white/70"><Film size={28} /></div>
                )}
                <span className="absolute left-2 bottom-2 flex items-center gap-1 text-xs text-white bg-black/65 px-2 py-1 rounded-md">
                  <Video size={12} /> {video.duration}
                </span>
                <span className={`absolute right-2 bottom-2 text-[11px] font-medium px-2 py-1 rounded-md ${
                  video.progress === "已完成" ? "bg-green-500 text-white"
                    : video.progress === "拆解失败" ? "bg-red-600 text-white"
                    : video.progress === "待拆解" ? "bg-slate-600 text-white" : "bg-amber-500 text-white"
                }`}>
                  {video.progress}
                </span>
              </div>
              <div className="p-3">
                <h3 className="text-base font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{video.title}</h3>
                <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="truncate">{userNickname}</span>
                  <span>·</span>
                  <span className="shrink-0">{video.time === "刚刚" ? video.time : `${video.date} ${video.time}`}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        {filteredVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Film size={32} className="opacity-30 mb-3" />
            <p className="text-sm">未找到符合条件的视频</p>
          </div>
        )}
      </div>
      {filteredVideos.length > 0 && (
        <ListPagination
          total={filteredVideos.length}
          page={page}
          pageSize={pageSize}
          onPageChange={changePage}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); changePage(1); }}
        />
      )}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const videoTasks = useViralVideoTasks();
  const openAiSearch = (query: string) => {
    setAiSearchQuery(query);
    setActiveNav("ai");
  };
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState("home");
  const [activePlatform, setActivePlatform] = useState("all");
  const [timeFilter, setTimeFilter] = useState("today");
  const [cardFilter, setCardFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCards, setVisibleCards] = useState<Card[]>(() => generateCards(mockCards, 1));
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const trackedHotspots = useTracked();
  const selectedHotspots = trackedHotspots.filter((item) => item.level || item.alert);
  const trackedCards: Card[] = selectedHotspots
    .filter((item) => !visibleCards.some((card) => card.title === item.title))
    .map((item, index) => ({
      id: -(index + 1), hotspotId: item.id, type: "热门事件", platform: "",
      title: item.title, summary: item.summary, source: item.source,
      time: item.publishedAt, tags: item.keywords,
      suggestion: item.level === "必追热点" ? "请立即跟进" : item.level === "建议热点" ? "自行选择是否跟进" : "供创作参考",
    }));
  const feedCards = [...trackedCards, ...visibleCards.map((card) => ({
    ...card, hotspotId: selectedHotspots.find((item) => item.title === card.title)?.id,
  }))];
  const [selectedHomeArticle, setSelectedHomeArticle] = useState<ArticleDetail | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      const next = page + 1;
      setVisibleCards((prev) => [...prev, ...generateCards(mockCards, next)]);
      setPage(next);
      setLoading(false);
    }, 900);
  }, [loading, page]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const timeFilters = [
    { id: "today", label: "今日" }, { id: "day", label: "本日" },
    { id: "3days", label: "近3天" }, { id: "week", label: "近一周" },
  ];
  const cardTypeFilters = [
    { id: "all", label: "全部" }, { id: "hot", label: "热门事件" },
    { id: "news", label: "早晚报" }, { id: "trends", label: "热搜" },
    { id: "subscribe", label: "订阅更新" }, { id: "inspire", label: "灵感" },
    { id: "topic", label: "建议选题" },
    { id: "competitor", label: "竞品洞察" }, { id: "industry", label: "行业洞察" },
  ];

  const [homeTab, setHomeTab] = useState<"feed" | "ideas" | "saved">("feed");
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const activeNavDef = navDefs.find((n) => n.id === activeNav) ?? { id: "inspire-assistant", label: "灵感助手", subtitle: "我的收藏&灵感库", iconBg: "from-yellow-400 to-orange-500", icon: <Bookmark size={18} className="text-white" /> };

  const renderContent = () => {
    switch (activeNav) {
      case "home": return (
        <div className="flex flex-col h-full">
          {/* ── Tab bar ── */}
          <div className="flex items-center gap-0 border-b border-border mb-4 flex-shrink-0">
            {([
              { id: "feed",  label: "灵感库" },
              { id: "ideas", label: "话题创意" },
              { id: "saved", label: "话题收藏" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHomeTab(tab.id)}
                className={`relative px-5 py-2.5 text-sm font-medium transition-colors ${
                  homeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {homeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* ── 灵感库 tab ── */}
          {homeTab === "feed" && (
            <>
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {cardTypeFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setCardFilter(filter.id)}
                      className={`text-xs px-3 py-2 rounded-lg border font-medium transition-all whitespace-nowrap ${
                        cardFilter === filter.id
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-primary hover:bg-primary/5"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="w-56 flex-shrink-0 flex items-center bg-card border border-border rounded-lg px-3 py-2 gap-2">
                  <Search size={13} className="text-muted-foreground flex-shrink-0" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索信息流..."
                    className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
                  {timeFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTimeFilter(filter.id)}
                      className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                        timeFilter === filter.id ? "bg-primary text-white font-medium" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div style={{ columns: 4, columnGap: "12px" }} className="pb-2">
                  {feedCards.filter((card) => String(card.type) !== "我的任务").map((card) => (
                    <InspirationCard
                      key={card.id}
                      card={card}
                      onOpen={(selectedCard) => setSelectedHomeArticle({
                        id: selectedCard.hotspotId ?? `home-card-${selectedCard.id}`,
                        category: selectedCard.type,
                        source: selectedCard.source,
                        title: selectedCard.title,
                        publishedAt: selectedCard.time,
                        summary: selectedCard.summary,
                        keywords: selectedCard.tags,
                        context: selectedCard.suggestion,
                      })}
                    />
                  ))}
                </div>
                <div ref={loaderRef} className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
                  {loading ? (
                    <><div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> 正在加载更多...</>
                  ) : (
                    <span className="opacity-40">向下滚动加载更多</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── 话题创意 tab ── */}
          {homeTab === "ideas" && <TopicIdeasTab />}

          {/* ── 话题收藏 tab ── */}
          {homeTab === "saved" && <TopicSavedTab />}
        </div>
      );
      case "ai":       return <AISearchPage initialQuery={aiSearchQuery} />;
      case "briefing":   return <BriefingPage />;
      case "hotevents":    return <HotEventsPage onSearch={openAiSearch} />;
      case "competitor":   return <CompetitorPage onSearch={openAiSearch} />;
      case "industry":     return <IndustryPage onSearch={openAiSearch} />;
      case "viral-analysis":    return <ViralAnalysisPage tasks={videoTasks} />;
      case "inspire-assistant": return <InspireAssistantPage />;
      case "social":   return <SocialTrendsPage activePlatform={activePlatform} setActivePlatform={setActivePlatform} />;
      case "accounts": return <SocialPage />;
      case "calendar": return <CalendarPage />;
      default:         return <PlaceholderPage nav={activeNavDef} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{ fontFamily: "'Noto Sans SC', Inter, system-ui, sans-serif" }}>
      <Toaster position="bottom-right" />
      {showSubscribeModal && <SubscribeModal onClose={() => setShowSubscribeModal(false)} />}
      {selectedHomeArticle && <ArticleDetailDrawer article={selectedHomeArticle} onClose={() => setSelectedHomeArticle(null)} />}

      {/* ── Left sidebar — icon+label nav ── */}
      <div className="w-52 bg-white border-r border-border flex flex-col flex-shrink-0 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 pb-4 border-b border-border mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-foreground leading-tight">灵感工作台</span>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {navDefs.map((nav) => {
            const isActive = activeNav === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => {
                  if (nav.id === "ai" && activeNav !== "ai") setAiSearchQuery("");
                  setActiveNav(nav.id);
                }}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all text-left ${isActive ? "bg-blue-50" : "hover:bg-muted"}`}
              >
                {/* Colored icon square */}
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${nav.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  {nav.icon}
                </div>
                {/* Label */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium leading-tight truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                      {nav.label}
                    </span>
                    {nav.isNew && (
                      <span className="flex-shrink-0 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">NEW</span>
                    )}
                  </div>
                  {nav.subtitle && (
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{nav.subtitle}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom tools */}
        <div className="px-2 pt-3 border-t border-border space-y-1">
          <button
            onClick={() => setActiveNav("inspire-assistant")}
            className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all text-left ${activeNav === "inspire-assistant" ? "bg-blue-50" : "hover:bg-muted"}`}
          >
            <Bookmark size={16} className={activeNav === "inspire-assistant" ? "text-primary" : "text-muted-foreground"} />
            <div className={`text-sm font-medium leading-tight ${activeNav === "inspire-assistant" ? "text-primary" : "text-foreground"}`}>我的灵感线索库</div>
          </button>
        </div>
      </div>

      {/* Secondary panel removed */}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

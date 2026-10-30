(function(root,factory){ const api=factory(); if(typeof module==="object"&&module.exports) module.exports=api; else root.ContentOrganization=api; })(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const ENGLISH_PREFIX="content/columns/english-reads/";
const ENGLISH_HUB="content/columns/english-reads.md";
const COLLECTIONS=[
  {
    "id": "mybatis",
    "title": "MyBatis 源码拆解",
    "description": "从整体调用链开始，依次理解配置、代理、会话、执行器、参数、缓存与插件。",
    "area": "Java 后端",
    "paths": [
      "content/learning/source-reading/mybatis-source-01-architecture-core-flow.md",
      "content/learning/source-reading/mybatis-source-02-configuration-loading.md",
      "content/learning/source-reading/mybatis-source-03-mapper-dynamic-proxy.md",
      "content/learning/source-reading/mybatis-source-04-sqlsession.md",
      "content/learning/source-reading/mybatis-source-05-executor.md",
      "content/learning/source-reading/mybatis-source-06-param-binding-prepared-statement.md",
      "content/learning/source-reading/mybatis-source-07-first-level-cache.md",
      "content/learning/source-reading/mybatis-source-08-second-level-cache.md",
      "content/learning/source-reading/mybatis-source-09-plugin-interceptor.md"
    ]
  },
  {
    "id": "vue-typescript",
    "title": "Vue 3 与 TypeScript",
    "description": "先补齐类型基础，再读响应式、组件通信与工程化。",
    "area": "前端",
    "paths": [
      "content/learning/frontend/2026-07-29-01-typescript-for-vue3-foundations.md",
      "content/learning/frontend/2026-07-29-02-vue3-typescript-reactivity.md",
      "content/learning/frontend/2026-07-29-03-vue3-router-pinia-communication.md",
      "content/learning/frontend/2026-07-29-04-vue3-advanced-engineering.md"
    ]
  },
  {
    "id": "unit-circle",
    "title": "从单位圆理解三角函数",
    "description": "先理解旋转与对称，再查阅和推导常用公式。",
    "area": "数学",
    "paths": [
      "content/learning/exam-math/2026-09-01-unit-circle-trigonometric-formulas.md",
      "content/learning/exam-math/2026-09-02-unit-circle-40-trig-formulas.md"
    ]
  },
  {
    "id": "langgraph",
    "title": "LangGraph：从基础到记忆",
    "description": "先建立控制流与工具调用的整体认识，再进入线程内和跨线程记忆。",
    "area": "AI Agent",
    "paths": [
      "content/learning/ai-agent/2026-09-30-langgraph-basics.md",
      "content/learning/ai-agent/2026-10-02-langgraph-memory.md"
    ]
  },
  {
    "id": "agent-engineering",
    "title": "Agent 工程阅读地图",
    "description": "按问题选读：运行时、框架实践、检索、工具调用与记忆。",
    "area": "AI Agent",
    "ordered": false,
    "paths": [
      "content/learning/ai-agent/2026-10-29-agent-runtime-security-interview-review.md",
      "content/learning/ai-agent/2026-10-28-agent-intent-workflow-interview-review.md",
      "content/learning/ai-agent/2026-10-02-langgraph-memory.md",
      "content/learning/ai-agent/2026-09-07-agent-harness-evolution.md",
      "content/learning/ai-agent/2026-08-31-hermes-agent-official-docs-study-extension-map.md",
      "content/learning/ai-agent/claude-code-grep-vs-rag-code-retrieval.md",
      "content/learning/ai-agent/rag-hybrid-search-meilisearch.md"
    ]
  },
  {
    "id": "java-threadpool-worker-condition",
    "title": "Java 线程池：从执行流程到阻塞唤醒",
    "description": "先看线程池扩容与拒绝，再沿 Worker、BlockingQueue 和 Condition 深入源码，并连接 408 生产者—消费者。",
    "area": "Java 后端",
    "paths": [
      "content/learning/java/2026-08-29-thread-pool-queue-full-rejection-policies.md",
      "content/learning/java/2026-10-30-threadpool-worker-blockingqueue-condition-interview-review.md"
    ]
  },
  {
    "id": "interview-deep-dive",
    "title": "面试深挖",
    "description": "围绕具体提问组织的长篇手册，按文内目录查阅。",
    "area": "Java 后端",
    "ordered": false,
    "paths": [
      "content/columns/interview-deep-dive.md"
    ]
  },
  {
    "id": "data-structure-past-questions",
    "title": "数据结构综合应用题年表（2009–2026）",
    "description": "按年份逐年收齐每年综合卷的数据结构算法题：题意、考点、思路、参考代码与复杂度。",
    "area": "计算机基础",
    "paths": [
      "content/columns/data-structure-past-questions.md",
      "content/columns/data-structure-past-questions/2009-single-linked-list-kth-from-end.md",
      "content/columns/data-structure-past-questions/2010-array-rotate-left.md",
      "content/columns/data-structure-past-questions/2011-median-of-two-sorted-sequences.md",
      "content/columns/data-structure-past-questions/2012-linked-list-common-suffix-and-merge-order.md",
      "content/columns/data-structure-past-questions/2013-majority-element-and-search-probability.md",
      "content/columns/data-structure-past-questions/2014-binary-tree-wpl-and-link-state-graph.md",
      "content/columns/data-structure-past-questions/2015-delete-abs-duplicates-in-linked-list.md",
      "content/columns/data-structure-past-questions/2016-regular-k-ary-tree-and-set-partition.md",
      "content/columns/data-structure-past-questions/2017-expression-tree-to-infix.md",
      "content/columns/data-structure-past-questions/2018-first-missing-positive-integer.md",
      "content/columns/data-structure-past-questions/2019-linked-list-reorder-and-growable-queue.md",
      "content/columns/data-structure-past-questions/2020-min-triple-distance-and-prefix-code.md",
      "content/columns/data-structure-past-questions/2021-euler-path-and-comparison-count-sort.md",
      "content/columns/data-structure-past-questions/2022-array-stored-binary-search-tree-check.md",
      "content/columns/data-structure-past-questions/2023-outdegree-exceeds-indegree-and-replacement-selection-sort.md",
      "content/columns/data-structure-past-questions/2024-unique-topological-order-and-quadratic-probing.md",
      "content/columns/data-structure-past-questions/2025-range-product-max-and-aoa-network.md",
      "content/columns/data-structure-past-questions/2026-bst-nearest-to-k-and-stack-permutations.md"
    ]
  }
];
const ENGLISH_TOPICS=[
 {id:"technology",label:"科技与数字生活",tags:["Technology","Privacy"]},
 {id:"society",label:"社会与公共议题",tags:["Society","Public Policy","Cities","Design","Community","Consumer Rights","Transportation"]},
 {id:"business",label:"商业与工作",tags:["Business","Work","Career","Economics","Industry","Labor","Productivity"]},
 {id:"education",label:"教育与心理",tags:["Education","Psychology","Youth","Child Development","Learning","Parenting","Decision Making","Reading","Habits"]},
 {id:"environment",label:"环境与科学",tags:["Environment","Climate","Science","Animal Behavior","Agriculture","Food","Conservation","Energy","Consumer Culture"]},
 {id:"life",label:"健康与生活",tags:["Health","Public Health","Aging","Sports"]}
];
function englishTopic(article){
 for(const tag of article.tags||[]){ const group=ENGLISH_TOPICS.find(g=>g.tags.includes(tag)); if(group)return group; }
 return null;
}
function organizeArticle(article){
 const a={...article};
 if(a.visibility!=="public")return a;
 const path=a.path||"";
 a.title=String(a.title||"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
 if(path.startsWith(ENGLISH_PREFIX)||path===ENGLISH_HUB){ a.section="reading";a.lane="reading";a.contentKind=a.readingFormat==="guide"?"阅读导读":"阅读原文";a.collectionId="english"; }
 if(path==="content/columns/neo4j-wechat-shortest-path.md"){a.section="learning";a.area="数据与中间件";a.module="图数据库与图算法";}
 if(path==="content/columns/cordis-java-dynamic-architecture.md"){a.section="learning";a.area="工程与架构";a.module="插件与生命周期";}
 if(path==="content/columns/interview-deep-dive.md"){a.section="learning";a.area="Java 后端";}
 if(path.includes("/references/physics/")){a.section="learning";a.area="物理";a.lane="theory";a.contentKind="参考资料";}
 if(path.includes("/personal-notes/math/")){a.section="learning";a.area="数学";a.lane="theory";a.contentKind="参考资料";}
 if(/Redis事务/.test(a.title)){a.module="Redis 与缓存";}
 if(a.section==="reading"&&!a.collectionId){
  const t=path+" "+a.title;
  a.readingTopic=/history|赵括|历史/.test(t)?"历史与文明":/finance|投资|基金/.test(t)?"市场与商业":/society|社会/.test(t)?"社会观察":"生活与职业";
 }
 a.topic=a.module||a.area||"待归类";
 if(!a.contentKind){const t=a.type||"";a.contentKind=/路线图|自测题单/.test(t)?t:/复盘|实战/.test(t)?"实践记录":/参考|资料/.test(t)?"参考资料":/教程|指南/.test(t)?"教程":/摘录|札记/.test(t)?"阅读摘录":"知识笔记";}
 if(a.section==="projects")a.contentKind=/方案|设计/.test(a.title)?"设计方案":"实践记录";
 return a;
}
function collections(articles){
 const visible=new Map(articles.filter(a=>a.visibility==="public").map(a=>[a.path,a]));
 return COLLECTIONS.map(c=>({...c,articles:c.paths.map(p=>visible.get(p)).filter(Boolean)})).filter(c=>c.articles.length);
}
function collectionFor(path,articles){return collections(articles).filter(c=>c.paths.includes(path));}
function updates(articles,limit=7){
 const sorted=articles.filter(a=>a.visibility==="public"&&a.section!=="about").slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")||a.path.localeCompare(b.path));
 const used=new Set(),out=[];
 for(const article of sorted){
  const c=collectionFor(article.path,articles)[0];
  const key=article.collectionId==="english"||article.path.startsWith(ENGLISH_PREFIX)||article.path===ENGLISH_HUB?"english":c?.id;
  if(key&&used.has(key))continue;
  if(key)used.add(key);
  if(key==="english"){
   const batch=sorted.filter(a=>a.path.startsWith(ENGLISH_PREFIX)&&a.date===article.date);
   out.push({...article,title:"English Reads",path:ENGLISH_HUB,summary:`本次收录 ${batch.length} 篇英文短文，进入集合按主题选读。`,updateLabel:"英文阅读 · 批量收录",collectionLink:null});
  }else out.push({...article,updateLabel:c?`${c.title} · 系列更新`:article.area||"近期更新",collectionLink:c?`#/collection/${c.id}`:null});
  if(out.length>=limit)break;
 }
 return out;
}
return {ENGLISH_PREFIX,ENGLISH_HUB,COLLECTIONS,ENGLISH_TOPICS,englishTopic,organizeArticle,collections,collectionFor,updates};
});

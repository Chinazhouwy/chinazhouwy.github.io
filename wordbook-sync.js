(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WordbookSync=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='wy.english-wordbook.sync.v1';
  function createSync({local,storage,request,onChange=()=>{},enabled=true}) {
    let meta={revision:0,migrated:false,pending:[]},state={kind:enabled?'local':'mirror',message:''},flight=null,csrf='',storageWarning='';
    try { const saved=JSON.parse(storage.getItem(KEY)||'null');
      if(saved && Array.isArray(saved.pending) && Number.isSafeInteger(saved.revision))meta=saved;
    } catch { storageWarning='同步队列未能读取，请保留本机导出备份。'; }
    const emit=(kind,message='')=>{state={kind,message};onChange();};
    function persist(){try{storage.setItem(KEY,JSON.stringify(meta));}catch{storageWarning='浏览器无法保存待同步队列，请联网同步后再关闭页面。';}}
    function op(type,entry,word){return {localId:`${Date.now()}-${Math.random().toString(36).slice(2)}`,type,entry,word,baseRevision:meta.revision};}
    function refreshMeta(){try{const saved=JSON.parse(storage.getItem(KEY)||'null');if(saved && Array.isArray(saved.pending) && Number.isSafeInteger(saved.revision))meta=saved;}catch{}}
    function queue(type,entry,word){refreshMeta();const term=word||entry.word;meta.pending=meta.pending.filter(p=>(p.word||p.entry?.word)!==term);meta.pending.push(op(type,entry,word));persist();emit('local','已保存在本机，等待同步');}
    function apply(snapshot){
      if(!snapshot || snapshot.schemaVersion!==1 || !Array.isArray(snapshot.words) || !Number.isSafeInteger(snapshot.revision))throw new Error('服务器返回的生词本格式不正确');
      const map=new Map(snapshot.words.map(e=>[e.word,e]));
      for(const p of meta.pending){if(p.type==='remove')map.delete(p.word);else map.set(p.entry.word,p.entry);}
      local.replace([...map.values()]);meta.revision=snapshot.revision;persist();onChange();
    }
    async function perform(){
      if(!enabled){emit('mirror');return false;}
      refreshMeta();emit('syncing');
      try {
        const session=await request('/admin/api/session');csrf=session.csrf;
        if(!meta.migrated){
          const queued=new Set(meta.pending.map(p=>p.word||p.entry?.word));
          meta.pending.push(...local.entries().filter(e=>!queued.has(e.word)).map(e=>op('migrate',e)));
          meta.migrated=true;persist();
        }
        let snapshot=await request('/admin/api/wordbook'),conflicts=[];
        while(meta.pending.length){
          const batch=meta.pending.slice(0,200);
          snapshot=await request('/admin/api/wordbook/sync',{method:'POST',csrf,body:{operations:batch}});
          const ids=new Set(batch.map(p=>p.localId));refreshMeta();meta.pending=meta.pending.filter(p=>!ids.has(p.localId));
          conflicts.push(...(snapshot.conflicts||[]));apply(snapshot);
        }
        refreshMeta();apply(snapshot);
        emit('synced',conflicts.length?'其他设备已更新部分词条，已保留服务器较新的版本。':'');return true;
      } catch(error){emit(error.status===401?'login':'offline',error.status===401?'请登录以同步；本机收藏仍保留。':`暂未同步：${error.message}。本机收藏仍保留，可重试。`);return false;}
    }
    function sync(){if(!flight){const run=()=>perform();flight=(typeof navigator!=='undefined' && navigator.locks?navigator.locks.request('wy-wordbook-sync',run):run()).finally(()=>{flight=null;});}return flight;}
    return {
      status:()=>({...state,pending:meta.pending.length,warning:storageWarning}),
      add(entry){const saved=local.add(entry);queue('add',local.entries().find(e=>e.word===entry.word));void sync();return saved;},
      remove(word){const saved=local.remove(word);queue('remove',null,word);void sync();return saved;},
      import(text){const before=new Set(local.entries().map(e=>e.word));const saved=local.import(text);for(const e of local.entries())if(!before.has(e.word))queue('add',e);void sync();return saved;},
      sync,
      async login(password){await request('/admin/api/login',{method:'POST',body:{password}});return sync();}
    };
  }
  return {createSync,KEY};
});

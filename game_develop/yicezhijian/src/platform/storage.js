export class MemoryStorage {
  constructor(){this.data=new Map();}
  load(key){return this.data.get(key)??null;}
  save(key,value){this.data.set(key,structuredClone(value));}
}

export class BrowserStorage {
  constructor(storage=window.localStorage){this.storage=storage;}
  load(key){try{return JSON.parse(this.storage.getItem(key)||'null');}catch{return null;}}
  save(key,value){this.storage.setItem(key,JSON.stringify(value));}
}

export class Random {
  constructor(seed=Date.now()){this.seed=seed>>>0;}
  next(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  int(max){return Math.floor(this.next()*max);}
  range(min,max){return min+this.next()*(max-min);}
}

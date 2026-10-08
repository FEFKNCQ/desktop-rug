// Only one native icon batch can be in flight. Draining includes a batch that
// was already sent, so Undo/new rounds cannot overtake old animation results.
export class SweepQueue {
  constructor(send,done,failed){this.send=send;this.done=done;this.failed=failed;this.pending=[];this.running=null;}
  add(id){if(!this.pending.includes(id))this.pending.push(id);}
  flush(){
    if(this.running)return this.running;
    if(!this.pending.length)return Promise.resolve();
    const ids=this.pending.splice(0);
    this.running=Promise.resolve().then(()=>this.send(ids)).then(result=>this.done(result,ids),error=>this.failed(ids,error)).finally(()=>{this.running=null;});
    return this.running;
  }
  async drain(){while(this.running||this.pending.length)await this.flush();}
}

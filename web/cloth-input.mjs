// One unacknowledged motion plus the newest pending motion. A busy simulation
// never has to replay hundreds of obsolete pointer locations after a fast drag.
export class ClothInput {
  constructor(post){this.post=post;this.sequence=0;this.flight=0;this.pending=null;this.sent=0;this.coalesced=0;}
  send(data){
    if(data.type!=='move'&&data.type!=='translate'){this.flush();this.post(data);return;}
    if(this.pending&&this.pending.type!==data.type)this.flush();
    if(this.pending){this.coalesced++;if(data.type==='translate'){this.pending.x+=data.x;this.pending.y+=data.y;}else this.pending=data;}
    else this.pending={...data};
    if(!this.flight)this.flush();
  }
  flush(){if(!this.pending)return;const data=this.pending;this.pending=null;this.flight=++this.sequence;this.sent++;this.post({...data,motionSequence:this.flight});}
  acknowledge(sequence){if(sequence!==this.flight)return;this.flight=0;this.flush();}
  stats(){return {sent:this.sent,coalesced:this.coalesced,pending:this.pending?1:0,inFlight:this.flight?1:0};}
}

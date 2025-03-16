const BFIRlib = new (class {
    constructor(){
        this.bld = "";
    }

    ref(name,pos,size){
        return {name:name,pos:pos,size:size,isRef:true};
    }

    buildRef(name,data,off){
        if(data.memPos[name] == null){ throw `Cannot Find Variable '${name}'`; }
        let rtref = this.ref(name,data.memPos[name],data.memSize[name]);
        return (off?this.offsetRef(rtref,off):rtref);
    }

    offsetRef(ref,off){
        if(off >= ref.size){ throw `Out Of Bounds on Variable '${ref.name}'`; }
        return this.ref(`${ref.name}[${off}]`,ref.pos+Number(off),1);
    }

    done(){
        let c = this.bld;
        this.bld = "";
        return c;
    }

    copy(acc,a,b,type){
        if(["sub","add"].includes(type)){
            return this.doAt(a,"[-").doAt(b,{add:"+",sub:"-"}[type]).doAt(acc,"+").doAt(a,"]").doAt(acc,"[-").doAt(a,"+").doAt(acc,"]").done();
        }else {
            return this.doAt(b,"[-]").doAt(a,"[-").doAt(b,"+").doAt(acc,"+").doAt(a,"]").doAt(acc,"[-").doAt(a,"+").doAt(acc,"]").done();
        }
    }

    doAllRef(ref,code){
        this.bld += String(code+`>${code}`.repeat(ref.size-1)+"<".repeat(ref.size-1));
        return this;
    }

    doEachRef(ref,code){
        if(code.length > ref.size){ throw `Out Of Bounds on Variable '${ref.name}'`; }
        this.bld += String(code[0]);
        for(let i = 0; i < ref.size-1; i++){
            this.bld += `>${code[Number(i)+1]??""}`;
        }
        this.bld += "<".repeat(ref.size-1);
        return this;
    }

    raw(txt){
        this.bld += String(txt);
        return this;
    }

    doAt(ref,code){
        this.bld += `${">".repeat(ref.pos)}${code}${"<".repeat(ref.pos)}`;
        return this;
    }

    fromTo(aref,bref){
        let dist = aref.pos-bref.pos;
        this.bld += (dist<0?">":"<").repeat(Math.abs(dist));
        return this;
    }

    simplify(code){
        let ret = String(code);
        while(ret.includes("><") || ret.includes("+-") || ret.includes("<>") || ret.includes("-+")){
            ret = ret.replaceAll("><","").replaceAll("+-","").replaceAll("<>","").replaceAll("-+","");
        }
        return ret;
    }
})();

function compileBFIR(code){
    let tks = String(code).replaceAll("\t"," ").split("\n").map((rw)=>{
        return rw.trim().replaceAll("\\\\","\n").replaceAll("\\_","\t").replaceAll("\n","\\").split(" ").map(x=>x.replaceAll("_"," ")).map(x=>x.replaceAll("\t","_")).filter((a)=>{return a.length!=0;});
    }).filter((a)=>{return a.length!=0;});
    let ret = [];
    let data = {funcs:{},memptr:1,memPos:{acc:0},memSize:{acc:1}};
    data.funcs.sendRaw = ((args,lib,funclib)=>{
        return String(args.pop()).split("").map(x=>`${"+".repeat(x.charCodeAt(0))}.[-]`).join("");
    });
    data.funcs.sendRef = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let a = args.pop();
        return lib.fromTo(acc,a).doAllRef(a,".").fromTo(a,acc).done();
    });
    data.funcs.read = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let a = args.pop();
        return lib.fromTo(acc,a).doAllRef(a,",").fromTo(a,acc).done();
    });
    data.funcs.setString = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let str = args.pop();
        let a = args.pop();
        return lib.fromTo(acc,a).doEachRef(a,str.split("").map(x=>`[-]${"+".repeat(x.charCodeAt(0))}`)).fromTo(a,acc).done();
    });
    data.funcs.addString = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let str = args.pop();
        let a = args.pop();
        return lib.fromTo(acc,a).doEachRef(a,str.split("").map(x=>`${"+".repeat(x.charCodeAt(0))}`)).fromTo(a,acc).done();
    });
    data.funcs.subString = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let str = args.pop();
        let a = args.pop();
        return lib.fromTo(acc,a).doEachRef(a,str.split("").map(x=>`${"-".repeat(x.charCodeAt(0))}`)).fromTo(a,acc).done();
    });
    data.funcs.setNum = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let num = Number(args.pop());
        let a = args.pop();
        return lib.fromTo(acc,a).raw(`[-]${"+".repeat(Number(num))}`).fromTo(a,acc).done();
    });
    data.funcs.addNum = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let num = Number(args.pop());
        let a = args.pop();
        return lib.fromTo(acc,a).raw("+".repeat(Number(num))).fromTo(a,acc).done();
    });
    data.funcs.subNum = ((args,lib,data)=>{
        let acc = lib.buildRef("acc",data);
        let num = Number(args.pop());
        let a = args.pop();
        return lib.fromTo(acc,a).raw("-".repeat(Number(num))).fromTo(a,acc).done();
    });
    let prstack = [];

    try {
        let aref, bref;
        let accRef = BFIRlib.buildRef("acc",data);
        for(let ln of tks){
            switch(ln[0]){
                case("inline"):
                    ret.push(ln[1]);
                    break;
                case("malloc"):
                    data.memPos[ln[1]] = data.memptr;
                    data.memSize[ln[1]] = Number(ln[2]??1);
                    data.memptr += Number(ln[2]??1);
                    break;
                case("pushRef"):
                    prstack.push(BFIRlib.buildRef(ln[1],data,ln[2]));
                    break;
                case("push$"):
                    prstack.push(String(ln[1]));
                    break;
                case("push#"):
                    prstack.push(Math.floor(Number(ln[1])));
                    break;
                case("exec"):
                    if(!data.funcs[ln[1]]) throw `exec: Cannot Execute '${ln[1]}'`;
                    let rtd = data.funcs[ln[1]](prstack,BFIRlib,data);
                    if(rtd){ ret.push(String(rtd)); }
                    break;
                case("CLEAR"):
                    this.prstack = [];
                    break;
                case("debug"):
                    throw eval(ln.splice(1,ln.length-1).join(""));
                    break;
                case("moveAdd"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    bref = BFIRlib.buildRef(ln[3],data,ln[4]);
                    ret.push(`${BFIRlib.doAt(aref,"[-").doAt(bref,"+").doAt(aref,"]").done()}`);
                    break;
                case("moveSub"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    bref = BFIRlib.buildRef(ln[3],data,ln[4]);
                    ret.push(`${BFIRlib.doAt(aref,"[-").doAt(bref,"-").doAt(aref,"]").done()}`);
                    break;
                case("move"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    bref = BFIRlib.buildRef(ln[3],data,ln[4]);
                    ret.push(`${BFIRlib.doAt(bref,"[-]").doAt(aref,"[-").doAt(bref,"+").doAt(aref,"]").done()}`);
                    break;
                case("copy"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    bref = BFIRlib.buildRef(ln[3],data,ln[4]);
                    ret.push(BFIRlib.copy(accRef,aref,bref));
                    break;
                case("copyAdd"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    bref = BFIRlib.buildRef(ln[3],data,ln[4]);
                    ret.push(BFIRlib.copy(accRef,aref,bref,"add"));
                    break;
                case("copySub"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    bref = BFIRlib.buildRef(ln[3],data,ln[4]);
                    ret.push(BFIRlib.copy(accRef,aref,bref,"sub"));
                    break;
                case("inc"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    ret.push(BFIRlib.doAt(aref,"+").done());
                    break;
                case("dec"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    ret.push(BFIRlib.doAt(aref,"-").done());
                    break;
                case("while"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    ret.push(BFIRlib.doAt(aref,"[").done());
                    break;
                case("next"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    ret.push(BFIRlib.doAt(aref,"-]").done());
                    break;
                case("repeat"):
                    aref = BFIRlib.buildRef(ln[1],data,ln[2]);
                    ret.push(BFIRlib.doAt(aref,"]").done());
                    break;
                default:
                    throw `Cannot Use Undefined Keyword '${ln[0]}'`;
                    break;
            }
        }
        return BFIRlib.simplify(ret.join(''));
    }catch(err){
        return `BFIR Encountered Error | ${err}`
    }
}

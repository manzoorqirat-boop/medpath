const { useState, useEffect, useRef } = React;
const API = "https://medpath-production.up.railway.app";

const C = {
  navy:"#0A1628", navyMid:"#12243E", navyLight:"#1A3356",
  teal:"#0D8A89", tealBright:"#12BFBE", tealPale:"#E5F7F7",
  gold:"#D4A843", goldPale:"#FDF6E3",
  red:"#DC3545", redPale:"#FFF0F1",
  green:"#198754", greenPale:"#F0FFF5",
  orange:"#E07B12", orangePale:"#FFF4E5",
  blue:"#1A73E8", bluePale:"#EBF3FF",
  white:"#FFFFFF", offWhite:"#F5F8FA",
  g100:"#EDF1F5", g200:"#D4DCE8", g400:"#8A9BB0", g600:"#4A5D72",
};

const TESTS = [
  {id:"CBC",name:"Complete Blood Count",price:350,cat:"Hematology",eta:"4 hrs",fasting:false},
  {id:"LFT",name:"Liver Function Test",price:650,cat:"Biochemistry",eta:"6 hrs",fasting:true},
  {id:"KFT",name:"Kidney Function Test",price:600,cat:"Biochemistry",eta:"6 hrs",fasting:true},
  {id:"TSH",name:"Thyroid Profile (T3/T4/TSH)",price:800,cat:"Endocrinology",eta:"12 hrs",fasting:true},
  {id:"LIPID",name:"Lipid Profile",price:550,cat:"Biochemistry",eta:"6 hrs",fasting:true},
  {id:"HBA1C",name:"HbA1c",price:480,cat:"Diabetes",eta:"4 hrs",fasting:false},
  {id:"URINE",name:"Urine Routine & Microscopy",price:200,cat:"Microbiology",eta:"2 hrs",fasting:false},
  {id:"ECG",name:"Electrocardiogram (ECG)",price:300,cat:"Cardiology",eta:"1 hr",fasting:false},
  {id:"DENG",name:"Dengue NS1 / IgM / IgG",price:900,cat:"Serology",eta:"6 hrs",fasting:false},
  {id:"COVID",name:"COVID-19 RT-PCR",price:500,cat:"Molecular",eta:"12 hrs",fasting:false},
  {id:"VIT",name:"Vitamin D & B12 Panel",price:1100,cat:"Nutrition",eta:"24 hrs",fasting:false},
  {id:"CRP",name:"C-Reactive Protein",price:420,cat:"Immunology",eta:"4 hrs",fasting:false},
];

const PATIENTS = [
  {id:"PAT001",name:"Rajesh Kumar",age:42,gender:"Male",phone:"+91 98765 43210",blood:"B+",email:"rajesh@email.com",address:"12 Gandhi Nagar, Pune"},
];

const NOTIFS = [
  {id:1,type:"report",msg:"Your CBC report is ready.",time:"Today 10:30 AM",read:false},
  {id:2,type:"billing",msg:"Payment of Rs.1000 received.",time:"Today 9:15 AM",read:false},
  {id:3,type:"collect",msg:"Home collection scheduled for tomorrow.",time:"Yesterday",read:true},
];

const Badge = function({label,color,small}) {
  return React.createElement("span",{style:{background:color+"22",color,border:"1px solid "+color+"44",padding:small?"1px 7px":"2px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:700,whiteSpace:"nowrap"}},label);
};

const Card = function({children,style,onClick}) {
  return React.createElement("div",{onClick,style:{background:"#fff",borderRadius:14,border:"1px solid #D4DCE8",boxShadow:"0 2px 12px #0A162810",...style}},children);
};

const Btn = function({children,onClick,variant,small,full,disabled,style}) {
  variant = variant||"primary";
  const variants = {
    primary:{background:"#0D8A89",color:"#fff",border:"none"},
    gold:{background:"#D4A843",color:"#0A1628",border:"none"},
    danger:{background:"#DC3545",color:"#fff",border:"none"},
    outline:{background:"transparent",color:"#0D8A89",border:"2px solid #0D8A89"},
    ghost:{background:"#EDF1F5",color:"#4A5D72",border:"1px solid #D4DCE8"},
    green:{background:"#198754",color:"#fff",border:"none"},
    navy:{background:"#0A1628",color:"#fff",border:"none"},
  };
  return React.createElement("button",{onClick,disabled,style:{...variants[variant],padding:small?"6px 16px":"11px 24px",fontSize:small?12:14,fontWeight:700,borderRadius:9,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":undefined,opacity:disabled?0.55:1,...style}},children);
};

const Inp = function({label,...props}) {
  return React.createElement("div",{style:{marginBottom:14}},
    label&&React.createElement("label",{style:{display:"block",fontSize:11,fontWeight:700,color:"#4A5D72",marginBottom:5,textTransform:"uppercase",letterSpacing:0.6}},label),
    React.createElement("input",{...props,style:{width:"100%",padding:"10px 13px",borderRadius:9,border:"1.5px solid #D4DCE8",fontSize:14,outline:"none",background:"#F5F8FA",color:"#0A1628",fontFamily:"inherit",boxSizing:"border-box",...props.style}})
  );
};

const Sel = function({label,children,...props}) {
  return React.createElement("div",{style:{marginBottom:14}},
    label&&React.createElement("label",{style:{display:"block",fontSize:11,fontWeight:700,color:"#4A5D72",marginBottom:5,textTransform:"uppercase",letterSpacing:0.6}},label),
    React.createElement("select",{...props,style:{width:"100%",padding:"10px 13px",borderRadius:9,border:"1.5px solid #D4DCE8",fontSize:14,outline:"none",background:"#F5F8FA",color:"#0A1628",fontFamily:"inherit",boxSizing:"border-box",...props.style}},children)
  );
};

const Modal = function({title,onClose,children}) {
  return React.createElement("div",{style:{position:"fixed",inset:0,background:"#00000070",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20}},
    React.createElement(Card,{style:{width:420,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",padding:30}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}},
        React.createElement("h3",{style:{margin:0,fontSize:18,color:"#0A1628"}},title),
        React.createElement("button",{onClick:onClose,style:{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#8A9BB0"}},"×")
      ),
      children
    )
  );
};

const Stat = function({icon,label,value,color,sub}) {
  return React.createElement(Card,{style:{padding:"20px 22px"}},
    React.createElement("div",{style:{fontSize:28,marginBottom:8}},icon),
    React.createElement("div",{style:{fontSize:26,fontWeight:800,color:color||"#0D8A89"}},value),
    React.createElement("div",{style:{fontSize:13,color:"#8A9BB0",marginTop:2}},label),
    sub&&React.createElement("div",{style:{fontSize:11,color:"#8A9BB0",marginTop:4}},sub)
  );
};

const statusColor = function(s) {
  return {Pending:"#E07B12",Collected:"#1A73E8",Processing:"#0D8A89",Reported:"#7B2FBE",Dispatched:"#198754",Cancelled:"#DC3545"}[s]||"#8A9BB0";
};
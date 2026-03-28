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
function AdminDashboard() {
  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 6px",fontSize:24,color:"#0A1628"}},"Admin Dashboard"),
    React.createElement("p",{style:{margin:"0 0 22px",color:"#8A9BB0",fontSize:13}},"Overview · "+new Date().toDateString()),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:22}},
      React.createElement(Stat,{icon:"🧪",label:"Today Samples",value:"5",color:"#0D8A89"}),
      React.createElement(Stat,{icon:"👥",label:"Total Patients",value:"124",color:"#1A73E8"}),
      React.createElement(Stat,{icon:"💰",label:"Revenue",value:"₹12,450",color:"#198754"}),
      React.createElement(Stat,{icon:"⏳",label:"Pending Dues",value:"₹3,200",color:"#DC3545"}),
      React.createElement(Stat,{icon:"🚗",label:"Home Collections",value:"3",color:"#7B2FBE"}),
      React.createElement(Stat,{icon:"⚡",label:"Urgent",value:"2",color:"#E07B12"})
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}},
      React.createElement(Card,{style:{padding:22}},
        React.createElement("h3",{style:{margin:"0 0 14px",fontSize:15,color:"#0A1628"}},"Sample Pipeline"),
        ["Pending","Collected","Processing","Reported","Dispatched"].map(function(st) {
          const counts = {Pending:2,Collected:1,Processing:3,Reported:4,Dispatched:5};
          const pct = counts[st]*10;
          return React.createElement("div",{key:st,style:{marginBottom:12}},
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4}},
              React.createElement("span",{style:{fontSize:13,color:"#0A1628"}},st),
              React.createElement("span",{style:{fontWeight:700,color:statusColor(st)}},counts[st])
            ),
            React.createElement("div",{style:{height:6,background:"#EDF1F5",borderRadius:3}},
              React.createElement("div",{style:{height:"100%",background:statusColor(st),borderRadius:3,width:pct+"%"}})
            )
          );
        })
      ),
      React.createElement(Card,{style:{padding:22}},
        React.createElement("h3",{style:{margin:"0 0 14px",fontSize:15,color:"#0A1628"}},"Recent Patients"),
        PATIENTS.concat([
          {id:"PAT002",name:"Priya Sharma",age:35,blood:"O+"},
          {id:"PAT003",name:"Amit Verma",age:58,blood:"A-"},
        ]).map(function(p) {
          return React.createElement("div",{key:p.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #EDF1F5"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontWeight:600,fontSize:13,color:"#0A1628"}},p.name),
              React.createElement("div",{style:{fontSize:11,color:"#8A9BB0"}},p.id+" · "+p.age+"yr")
            ),
            React.createElement(Badge,{label:p.blood,color:"#DC3545"})
          );
        })
      )
    )
  );
}

function AdminSamples() {
  const [samples,setSamples] = useState([
    {id:"SMP001",patient:"Rajesh Kumar",tests:["CBC","LFT"],status:"Processing",priority:"Normal",collected:"08:30 AM"},
    {id:"SMP002",patient:"Priya Sharma",tests:["TSH"],status:"Pending",priority:"Urgent",collected:"09:00 AM"},
    {id:"SMP003",patient:"Amit Verma",tests:["KFT"],status:"Reported",priority:"Normal",collected:"07:45 AM"},
  ]);

  function advance(id) {
    const order = ["Pending","Collected","Processing","Reported","Dispatched"];
    setSamples(function(prev) {
      return prev.map(function(s) {
        if(s.id!==id) return s;
        const next = order[order.indexOf(s.status)+1];
        return next?{...s,status:next}:s;
      });
    });
  }

  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 22px",fontSize:24,color:"#0A1628"}},"Sample Tracking"),
    React.createElement(Card,{style:{overflow:"hidden"}},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1.5fr 1.5fr 1fr 1fr 1fr",background:"#0A1628",padding:"11px 18px",gap:10}},
        ["Sample ID","Patient","Tests","Time","Status","Action"].map(function(h) {
          return React.createElement("div",{key:h,style:{color:"#fff",fontSize:11,fontWeight:700}},h);
        })
      ),
      samples.map(function(s,i) {
        return React.createElement("div",{key:s.id,style:{display:"grid",gridTemplateColumns:"1fr 1.5fr 1.5fr 1fr 1fr 1fr",padding:"13px 18px",gap:10,background:i%2?"#F5F8FA":"#fff",alignItems:"center"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#0D8A89"}},s.id),
            s.priority==="Urgent"&&React.createElement(Badge,{label:"URGENT",color:"#DC3545",small:true})
          ),
          React.createElement("div",{style:{fontSize:13,color:"#0A1628"}},s.patient),
          React.createElement("div",{style:{fontSize:12,color:"#4A5D72"}},s.tests.join(", ")),
          React.createElement("div",{style:{fontSize:11,color:"#8A9BB0"}},s.collected),
          React.createElement(Badge,{label:s.status,color:statusColor(s.status)}),
          s.status!=="Dispatched"&&React.createElement(Btn,{small:true,variant:"outline",onClick:function(){advance(s.id);}},"Advance →")
        );
      })
    )
  );
}

function AdminBillingPage() {
  const bills = [
    {id:"INV2025001",patient:"Rajesh Kumar",tests:["CBC","LFT"],amount:1000,paid:true},
    {id:"INV2025002",patient:"Priya Sharma",tests:["TSH"],amount:800,paid:false},
    {id:"INV2025003",patient:"Amit Verma",tests:["KFT"],amount:600,paid:true},
  ];
  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 22px",fontSize:24,color:"#0A1628"}},"Billing Overview"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:22}},
      React.createElement(Stat,{icon:"💰",label:"Total Revenue",value:"₹2,400",color:"#0D8A89"}),
      React.createElement(Stat,{icon:"✅",label:"Collected",value:"₹1,600",color:"#198754"}),
      React.createElement(Stat,{icon:"⏳",label:"Outstanding",value:"₹800",color:"#DC3545"}),
      React.createElement(Stat,{icon:"🧾",label:"Invoices",value:bills.length,color:"#1A73E8"})
    ),
    React.createElement(Card,{style:{overflow:"hidden"}},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1.5fr 1.5fr 1fr 1fr 1fr",background:"#0A1628",padding:"11px 18px",gap:8}},
        ["Invoice","Patient","Tests","Amount","Status","Action"].map(function(h) {
          return React.createElement("div",{key:h,style:{color:"#fff",fontSize:11,fontWeight:700}},h);
        })
      ),
      bills.map(function(b,i) {
        return React.createElement("div",{key:b.id,style:{display:"grid",gridTemplateColumns:"1fr 1.5fr 1.5fr 1fr 1fr 1fr",padding:"12px 18px",gap:8,background:i%2?"#F5F8FA":"#fff",alignItems:"center"}},
          React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#0D8A89"}},b.id),
          React.createElement("div",{style:{fontSize:13,color:"#0A1628",fontWeight:600}},b.patient),
          React.createElement("div",{style:{fontSize:11,color:"#4A5D72"}},b.tests.join(", ")),
          React.createElement("div",{style:{fontWeight:700,color:"#0A1628"}},"₹"+b.amount),
          React.createElement(Badge,{label:b.paid?"Paid":"Due",color:b.paid?"#198754":"#DC3545"}),
          !b.paid&&React.createElement(Btn,{small:true,variant:"danger"},"Mark Paid"),
          b.paid&&React.createElement(Btn,{small:true,variant:"ghost"},"Receipt")
        );
      })
    )
  );
}

function TechDashboard({user}) {
  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 22px",fontSize:24,color:"#0A1628"}},"Good morning, "+user.name.split(" ")[0]+" 👋"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:22}},
      React.createElement(Stat,{icon:"🧪",label:"Assigned",value:"4",color:"#0D8A89"}),
      React.createElement(Stat,{icon:"⚡",label:"Urgent",value:"1",color:"#DC3545"}),
      React.createElement(Stat,{icon:"✅",label:"Completed",value:"2",color:"#198754"}),
      React.createElement(Stat,{icon:"⏳",label:"Pending",value:"2",color:"#E07B12"})
    ),
    React.createElement(Card,{style:{padding:22}},
      React.createElement("h3",{style:{margin:"0 0 14px",fontSize:15,color:"#0A1628"}},"My Sample Queue"),
      [
        {id:"SMP001",patient:"Rajesh Kumar",tests:"CBC, LFT",status:"Processing"},
        {id:"SMP002",patient:"Priya Sharma",tests:"TSH",status:"Collected",urgent:true},
      ].map(function(s) {
        return React.createElement("div",{key:s.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #EDF1F5"}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontWeight:700,fontSize:13,color:"#0A1628"}},s.id+" · "+s.patient),
            React.createElement("div",{style:{fontSize:12,color:"#8A9BB0"}},s.tests)
          ),
          React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center"}},
            s.urgent&&React.createElement(Badge,{label:"URGENT",color:"#DC3545"}),
            React.createElement(Badge,{label:s.status,color:statusColor(s.status)})
          )
        );
      })
    )
  );
}

function ResultEntry() {
  const [sel,setSel] = useState(null);
  const samples = [
    {id:"SMP001",patient:"Rajesh Kumar",tests:["CBC"],status:"Processing"},
    {id:"SMP002",patient:"Priya Sharma",tests:["TSH"],status:"Collected"},
  ];
  const params = {
    CBC:[
      {name:"Haemoglobin",unit:"g/dL",range:"13-17"},
      {name:"Total WBC",unit:"cells/µL",range:"4000-11000"},
      {name:"Platelets",unit:"Lac/µL",range:"1.5-4.0"},
    ],
    TSH:[
      {name:"T3",unit:"ng/dL",range:"80-200"},
      {name:"T4",unit:"µg/dL",range:"5.1-14.1"},
      {name:"TSH",unit:"µIU/mL",range:"0.4-4.0"},
    ],
  };
  const [values,setValues] = useState({});

  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 22px",fontSize:24,color:"#0A1628"}},"Result Entry"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:sel?"280px 1fr":"1fr",gap:18}},
      React.createElement("div",null,
        samples.map(function(s) {
          return React.createElement(Card,{key:s.id,onClick:function(){setSel(s);setValues({});},style:{padding:16,marginBottom:10,cursor:"pointer",border:"2px solid "+(sel&&sel.id===s.id?"#0D8A89":"#D4DCE8"),background:sel&&sel.id===s.id?"#E5F7F7":"#fff"}},
            React.createElement("div",{style:{fontWeight:700,fontSize:13,color:"#0A1628"}},s.id+" · "+s.patient),
            React.createElement("div",{style:{fontSize:12,color:"#8A9BB0",marginTop:3}},s.tests.join(", ")),
            React.createElement(Badge,{label:s.status,color:statusColor(s.status)})
          );
        })
      ),
      sel&&React.createElement(Card,{style:{padding:26}},
        React.createElement("h3",{style:{margin:"0 0 16px",fontSize:17,color:"#0A1628"}},"Enter Results: "+sel.id),
        sel.tests.map(function(tid) {
          return React.createElement("div",{key:tid,style:{marginBottom:20}},
            React.createElement("div",{style:{fontWeight:700,fontSize:13,color:"#fff",background:"#0A1628",padding:"8px 14px",borderRadius:"8px 8px 0 0"}},tid+" Parameters"),
            React.createElement("div",{style:{border:"1px solid #D4DCE8",borderRadius:"0 0 8px 8px",overflow:"hidden"}},
              (params[tid]||[]).map(function(p,i) {
                return React.createElement("div",{key:p.name,style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",padding:"10px 14px",gap:10,background:i%2?"#F5F8FA":"#fff",alignItems:"center"}},
                  React.createElement("div",null,
                    React.createElement("div",{style:{fontSize:13,color:"#0A1628"}},p.name),
                    React.createElement("div",{style:{fontSize:10,color:"#8A9BB0"}},p.range+" "+p.unit)
                  ),
                  React.createElement("input",{type:"number",value:values[tid+"_"+p.name]||"",onChange:function(e){setValues(function(prev){var n={};Object.assign(n,prev);n[tid+"_"+p.name]=e.target.value;return n;});},placeholder:"Value",style:{padding:"7px 10px",borderRadius:7,border:"1.5px solid #D4DCE8",fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}),
                  React.createElement("div",{style:{fontSize:12,color:"#8A9BB0"}},p.unit)
                );
              })
            )
          );
        }),
        React.createElement("div",{style:{display:"flex",gap:10,marginTop:16}},
          React.createElement(Btn,{full:true,variant:"green",onClick:function(){setSel(null);}},"Submit Results ✓"),
          React.createElement(Btn,{full:true,variant:"ghost",onClick:function(){setSel(null);}},"Cancel")
        )
      )
    )
  );
}

function DoctorDashboard() {
  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 22px",fontSize:24,color:"#0A1628"}},"Doctor Dashboard"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:22}},
      React.createElement(Stat,{icon:"👥",label:"My Patients",value:"24",color:"#0D8A89"}),
      React.createElement(Stat,{icon:"📄",label:"To Review",value:"3",color:"#E07B12"}),
      React.createElement(Stat,{icon:"✅",label:"Signed Today",value:"2",color:"#198754"}),
      React.createElement(Stat,{icon:"⚠️",label:"Critical",value:"1",color:"#DC3545"})
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}},
      React.createElement(Card,{style:{padding:22}},
        React.createElement("h3",{style:{margin:"0 0 14px",fontSize:15,color:"#0A1628"}},"Pending Sign-off"),
        [
          {id:"SMP001",patient:"Rajesh Kumar",test:"CBC+LFT"},
          {id:"SMP003",patient:"Amit Verma",test:"KFT"},
        ].map(function(s) {
          return React.createElement("div",{key:s.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #EDF1F5"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontWeight:700,fontSize:13,color:"#0A1628"}},s.patient),
              React.createElement("div",{style:{fontSize:11,color:"#8A9BB0"}},s.test+" · "+s.id)
            ),
            React.createElement("div",{style:{display:"flex",gap:6}},
              React.createElement(Btn,{small:true,variant:"outline"},"Review"),
              React.createElement(Btn,{small:true,variant:"green"},"Sign ✓")
            )
          );
        })
      ),
      React.createElement(Card,{style:{padding:22}},
        React.createElement("h3",{style:{margin:"0 0 14px",fontSize:15,color:"#0A1628"}},"Recent Patients"),
        PATIENTS.concat([
          {id:"PAT002",name:"Priya Sharma",age:35,blood:"O+"},
          {id:"PAT003",name:"Amit Verma",age:58,blood:"A-"},
        ]).map(function(p) {
          return React.createElement("div",{key:p.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #EDF1F5"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontWeight:600,fontSize:13,color:"#0A1628"}},p.name),
              React.createElement("div",{style:{fontSize:11,color:"#8A9BB0"}},p.age+"yr")
            ),
            React.createElement(Badge,{label:p.blood,color:"#DC3545"})
          );
        })
      )
    )
  );
}

function PatientApp({user,onLogout}) {
  const [active,setActive] = useState("dashboard");
  const [cart,setCart] = useState([]);
  const [notifs,setNotifs] = useState(NOTIFS);
  const unread = notifs.filter(function(n){return !n.read;}).length;
  const nav = [
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"tests",icon:"🧪",label:"Book Tests"},
    {id:"homecollect",icon:"🚗",label:"Home Collection"},
    {id:"reports",icon:"📄",label:"My Reports"},
    {id:"billing",icon:"💳",label:"Billing"},
    {id:"family",icon:"👨‍👩‍👧",label:"Family"},
    {id:"notifications",icon:"🔔",label:"Notifications",badge:unread||undefined},
    {id:"profile",icon:"👤",label:"Profile"},
  ];
  const pages = {
    dashboard:React.createElement(PatientDashboard,{patient:user,setActive:setActive,notifs:notifs}),
    tests:React.createElement(BookTests,{cart:cart,setCart:setCart}),
    homecollect:React.createElement("div",{style:{padding:20}},React.createElement("h2",{style:{color:"#0A1628"}},"🚗 Home Collection"),React.createElement("p",{style:{color:"#8A9BB0",marginTop:8}},"Schedule doorstep collection. Call us at: +91 98765 00000")),
    reports:React.createElement(PatientReports,{patient:user}),
    billing:React.createElement(PatientBilling,{patient:user}),
    family:React.createElement(FamilyMembers,{patient:user}),
    notifications:React.createElement(NotificationsPage,{notifs:notifs,setNotifs:setNotifs}),
    profile:React.createElement(PatientProfile,{patient:user}),
  };
  return React.createElement("div",{style:{display:"flex",minHeight:"100vh",fontFamily:"Georgia,serif",background:"#F5F8FA"}},
    React.createElement(Sidebar,{role:"Patient",nav:nav,active:active,setActive:setActive,user:{...user,sub:user.id},onLogout:onLogout}),
    React.createElement("div",{style:{flex:1,padding:28,overflowY:"auto",maxHeight:"100vh"}},pages[active]||pages.dashboard)
  );
}

function AdminApp({user,onLogout}) {
  const [active,setActive] = useState("dashboard");
  const nav = [
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"samples",icon:"🔬",label:"Sample Tracking"},
    {id:"billing",icon:"💰",label:"Billing"},
  ];
  const pages = {
    dashboard:React.createElement(AdminDashboard,null),
    samples:React.createElement(AdminSamples,null),
    billing:React.createElement(AdminBillingPage,null),
  };
  return React.createElement("div",{style:{display:"flex",minHeight:"100vh",fontFamily:"Georgia,serif",background:"#F5F8FA"}},
    React.createElement(Sidebar,{role:"Admin",nav:nav,active:active,setActive:setActive,user:{...user,sub:"Administrator"},onLogout:onLogout}),
    React.createElement("div",{style:{flex:1,padding:28,overflowY:"auto",maxHeight:"100vh"}},pages[active]||pages.dashboard)
  );
}

function TechApp({user,onLogout}) {
  const [active,setActive] = useState("dashboard");
  const nav = [
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"results",icon:"📝",label:"Result Entry"},
  ];
  const pages = {
    dashboard:React.createElement(TechDashboard,{user:user}),
    results:React.createElement(ResultEntry,null),
  };
  return React.createElement("div",{style:{display:"flex",minHeight:"100vh",fontFamily:"Georgia,serif",background:"#F5F8FA"}},
    React.createElement(Sidebar,{role:"Technician",nav:nav,active:active,setActive:setActive,user:{...user,sub:"Lab Technician"},onLogout:onLogout}),
    React.createElement("div",{style:{flex:1,padding:28,overflowY:"auto",maxHeight:"100vh"}},pages[active]||pages.dashboard)
  );
}

function DoctorApp({user,onLogout}) {
  const [active,setActive] = useState("dashboard");
  const nav = [
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
  ];
  return React.createElement("div",{style:{display:"flex",minHeight:"100vh",fontFamily:"Georgia,serif",background:"#F5F8FA"}},
    React.createElement(Sidebar,{role:"Doctor",nav:nav,active:active,setActive:setActive,user:{...user,sub:"Senior Pathologist"},onLogout:onLogout}),
    React.createElement("div",{style:{flex:1,padding:28,overflowY:"auto",maxHeight:"100vh"}},React.createElement(DoctorDashboard,null))
  );
}

function App() {
  const [role,setRole] = useState(null);
  const [user,setUser] = useState(null);

  function handleLogin(u,back) {
    if(back){setRole(null);setUser(null);}
    else setUser(u);
  }

  function handleLogout(){setUser(null);setRole(null);}

  if(!role) return React.createElement(RoleSelectScreen,{onSelect:setRole});
  if(!user) return React.createElement(LoginScreen,{role:role,onLogin:handleLogin});
  if(role==="Patient") return React.createElement(PatientApp,{user:user,onLogout:handleLogout});
  if(role==="Admin") return React.createElement(AdminApp,{user:user,onLogout:handleLogout});
  if(role==="Technician") return React.createElement(TechApp,{user:user,onLogout:handleLogout});
  if(role==="Doctor") return React.createElement(DoctorApp,{user:user,onLogout:handleLogout});
  return null;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App,null));
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
const Sidebar = function({role,nav,active,setActive,user,onLogout}) {
  const roleColors = {Patient:"#0D8A89",Admin:"#0A1628",Technician:"#7B2FBE",Doctor:"#198754"};
  const rc = roleColors[role]||"#0D8A89";
  return React.createElement("div",{style:{width:230,minHeight:"100vh",background:"#0A1628",display:"flex",flexDirection:"column",padding:"0 0 20px",boxSizing:"border-box",flexShrink:0}},
    React.createElement("div",{style:{padding:"22px 20px 18px",borderBottom:"1px solid #ffffff18"}},
      React.createElement("div",{style:{fontSize:28,marginBottom:2}},"🔬"),
      React.createElement("div",{style:{color:"#D4A843",fontWeight:700,fontSize:17,letterSpacing:1}},"MedPath"),
      React.createElement("div",{style:{display:"inline-block",background:rc+"33",color:rc,border:"1px solid "+rc+"55",fontSize:10,padding:"2px 8px",borderRadius:20,marginTop:4,letterSpacing:0.6,fontWeight:700}},role.toUpperCase())
    ),
    React.createElement("div",{style:{flex:1,padding:"14px 10px"}},
      nav.map(function(n) {
        return React.createElement("button",{key:n.id,onClick:function(){setActive(n.id);},style:{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 13px",borderRadius:9,marginBottom:3,border:"none",cursor:"pointer",fontFamily:"inherit",background:active===n.id?rc:"transparent",color:active===n.id?"#fff":"#ffffff70",fontWeight:active===n.id?700:400,fontSize:13.5,textAlign:"left"}},
          React.createElement("span",{style:{fontSize:17}},n.icon),
          n.label,
          n.badge&&React.createElement("span",{style:{marginLeft:"auto",background:"#DC3545",color:"#fff",borderRadius:20,fontSize:10,padding:"1px 7px",fontWeight:700}},n.badge)
        );
      })
    ),
    React.createElement("div",{style:{padding:"14px 18px",borderTop:"1px solid #ffffff18"}},
      React.createElement("div",{style:{color:"#fff",fontSize:13,fontWeight:600,marginBottom:1}},user.name),
      React.createElement("div",{style:{color:"#ffffff55",fontSize:11,marginBottom:12}},user.sub||user.id),
      React.createElement("button",{onClick:onLogout,style:{background:"#ffffff15",border:"none",color:"#fff",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,width:"100%",fontFamily:"inherit"}},"Sign Out")
    )
  );
};

function RoleSelectScreen({onSelect}) {
  const roles = [
    {id:"Patient",icon:"🧑‍⚕️",label:"Patient Portal",desc:"Book tests, view reports, pay bills"},
    {id:"Admin",icon:"🏥",label:"Admin Dashboard",desc:"Manage all operations & staff"},
    {id:"Technician",icon:"🔬",label:"Lab Technician",desc:"Process samples & enter results"},
    {id:"Doctor",icon:"👨‍⚕️",label:"Doctor Panel",desc:"Review reports & add clinical notes"},
  ];
  return React.createElement("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0A1628 0%,#163055 55%,#0d4a4a 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Georgia,serif"}},
    React.createElement("div",{style:{textAlign:"center",width:"100%",maxWidth:700}},
      React.createElement("div",{style:{fontSize:60,marginBottom:10}},"🔬"),
      React.createElement("h1",{style:{color:"#D4A843",fontSize:38,fontWeight:400,margin:0,letterSpacing:2}},"MedPath LIS"),
      React.createElement("p",{style:{color:"#8BB8D4",marginTop:6,marginBottom:36,fontSize:15}},"Laboratory Information System · Select your role"),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:14}},
        roles.map(function(r) {
          return React.createElement("button",{key:r.id,onClick:function(){onSelect(r.id);},style:{background:"#ffffff0C",border:"1.5px solid #ffffff25",borderRadius:14,padding:"24px 16px",cursor:"pointer",color:"#fff",fontFamily:"inherit",textAlign:"center"}},
            React.createElement("div",{style:{fontSize:36,marginBottom:10}},r.icon),
            React.createElement("div",{style:{fontWeight:700,fontSize:15,color:"#D4A843",marginBottom:6}},r.label),
            React.createElement("div",{style:{fontSize:12,color:"#7FB3CC",lineHeight:1.5}},r.desc)
          );
        })
      )
    )
  );
}

function LoginScreen({role,onLogin}) {
  const [step,setStep] = useState(1);
  const [phone,setPhone] = useState("");
  const [otp,setOtp] = useState("");
  const [pw,setPw] = useState("");
  const [err,setErr] = useState("");
  const [name,setName] = useState("");
  const [isNew,setIsNew] = useState(false);
  const creds = {Admin:"admin",Technician:"tech123",Doctor:"doc123"};
  const staffUsers = {
    Admin:{name:"Admin User",id:"ADM001",sub:"Administrator"},
    Technician:{name:"Suresh Teknical",id:"STF002",sub:"Lab Technician"},
    Doctor:{name:"Dr. Anita Sharma",id:"STF001",sub:"Senior Pathologist"},
  };

  function staffLogin() {
    if(pw===creds[role]) {
      onLogin(staffUsers[role]);
    } else {
      setErr("Wrong password. Try: "+creds[role]);
    }
  }

  function sendOtp() {
    setStep(2);
  }

  function verifyOtp() {
    onLogin(PATIENTS[0]);
  }

  return React.createElement("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0A1628,#0d4a4a)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Georgia,serif"}},
    React.createElement(Card,{style:{width:380,padding:36}},
      React.createElement("div",{style:{textAlign:"center",marginBottom:24}},
        React.createElement("div",{style:{fontSize:36}},"🔬"),
        React.createElement("h2",{style:{margin:"6px 0 4px",color:"#0A1628",fontSize:22}},"MedPath LIS"),
        React.createElement("div",{style:{display:"inline-block",background:"#E5F7F7",color:"#0D8A89",padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:700}},role+" Login")
      ),
      role==="Patient" && !isNew && step===1 && React.createElement("div",null,
        React.createElement(Inp,{label:"Mobile Number",placeholder:"+91 9XXXXXXXXX",value:phone,onChange:function(e){setPhone(e.target.value);}}),
        React.createElement(Btn,{full:true,onClick:sendOtp},"Send OTP"),
        React.createElement("p",{style:{textAlign:"center",fontSize:12,color:"#8A9BB0",marginTop:14}},
          "New patient? ",
          React.createElement("span",{style:{color:"#0D8A89",cursor:"pointer"},onClick:function(){setIsNew(true);}},"Register")
        )
      ),
      role==="Patient" && !isNew && step===2 && React.createElement("div",null,
        React.createElement("p",{style:{fontSize:13,color:"#4A5D72",marginBottom:16}},"OTP sent to ",React.createElement("b",null,phone||"+91 98765 43210")),
        React.createElement(Inp,{label:"Enter OTP",placeholder:"6-digit OTP",value:otp,onChange:function(e){setOtp(e.target.value);}}),
        React.createElement(Btn,{full:true,onClick:verifyOtp},"Verify & Login"),
        React.createElement("p",{style:{textAlign:"center",fontSize:12,color:"#0D8A89",marginTop:12,cursor:"pointer"},onClick:function(){setStep(1);}},"← Change Number")
      ),
      role==="Patient" && isNew && React.createElement("div",null,
        React.createElement(Inp,{label:"Full Name",value:name,onChange:function(e){setName(e.target.value);},placeholder:"Full name"}),
        React.createElement(Inp,{label:"Mobile",placeholder:"+91 9XXXXXXXXX"}),
        React.createElement(Btn,{full:true,onClick:function(){onLogin({...PATIENTS[0],name:name||"New Patient"});}},"Register"),
        React.createElement("p",{style:{textAlign:"center",fontSize:12,color:"#0D8A89",marginTop:12,cursor:"pointer"},onClick:function(){setIsNew(false);}},"← Back to Login")
      ),
      role!=="Patient" && React.createElement("div",null,
        React.createElement(Inp,{label:"Username",placeholder:"Enter your email"}),
        React.createElement(Inp,{label:"Password",type:"password",placeholder:"Password",value:pw,onChange:function(e){setPw(e.target.value);setErr("");}}),
        err&&React.createElement("div",{style:{color:"#DC3545",fontSize:12,marginBottom:12}},err),
        React.createElement("div",{style:{fontSize:12,color:"#8A9BB0",marginBottom:14}},"Demo password: ",React.createElement("b",null,creds[role])),
        React.createElement(Btn,{full:true,onClick:staffLogin},"Login")
      ),
      React.createElement("p",{style:{textAlign:"center",fontSize:12,color:"#0D8A89",marginTop:16,cursor:"pointer"},onClick:function(){onLogin(null,true);}},"← Back to role selection")
    )
  );
}

function PatientDashboard({patient,setActive,notifs}) {
  const unread = notifs.filter(function(n){return !n.read;}).length;
  return React.createElement("div",null,
    React.createElement("div",{style:{marginBottom:26}},
      React.createElement("h2",{style:{margin:0,fontSize:26,color:"#0A1628"}},"Good morning, "+patient.name.split(" ")[0]+" 👋"),
      React.createElement("p",{style:{margin:"5px 0 0",color:"#8A9BB0",fontSize:14}},"Patient ID: "+patient.id+" · Welcome to your health dashboard")
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14,marginBottom:24}},
      React.createElement(Stat,{icon:"🧪",label:"Tests Booked",value:"8",color:"#0D8A89"}),
      React.createElement(Stat,{icon:"📄",label:"Reports Ready",value:"3",color:"#198754"}),
      React.createElement(Stat,{icon:"💳",label:"Pending Dues",value:"₹800",color:"#E07B12"}),
      React.createElement(Stat,{icon:"🔔",label:"Notifications",value:unread,color:"#DC3545"})
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}},
      React.createElement(Card,{style:{padding:22}},
        React.createElement("h3",{style:{margin:"0 0 16px",fontSize:15,color:"#0A1628"}},"Quick Actions"),
        [
          {label:"Book a New Test",icon:"🧪",tab:"tests"},
          {label:"Home Collection",icon:"🚗",tab:"homecollect"},
          {label:"View Reports",icon:"📄",tab:"reports"},
          {label:"Pay Bills",icon:"💳",tab:"billing"},
          {label:"Family Members",icon:"👨‍👩‍👧",tab:"family"},
          {label:"Notifications",icon:"🔔",tab:"notifications"},
        ].map(function(a) {
          return React.createElement("button",{key:a.tab,onClick:function(){setActive(a.tab);},style:{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:9,border:"1px solid #EDF1F5",background:"#F5F8FA",cursor:"pointer",marginBottom:8,fontFamily:"inherit",fontWeight:600,fontSize:13,color:"#0A1628",textAlign:"left"}},
            React.createElement("span",{style:{fontSize:19}},a.icon),
            a.label,
            React.createElement("span",{style:{marginLeft:"auto",color:"#0D8A89"}},"›")
          );
        })
      ),
      React.createElement(Card,{style:{padding:22}},
        React.createElement("h3",{style:{margin:"0 0 16px",fontSize:15,color:"#0A1628"}},"Recent Notifications"),
        notifs.slice(0,4).map(function(n) {
          return React.createElement("div",{key:n.id,style:{padding:"10px 0",borderBottom:"1px solid #EDF1F5"}},
            React.createElement("div",{style:{fontSize:13,color:"#0A1628",fontWeight:n.read?400:600}},n.msg),
            React.createElement("div",{style:{fontSize:11,color:"#8A9BB0",marginTop:3}},n.time)
          );
        })
      )
    )
  );
}

function BookTests({cart,setCart}) {
  const [search,setSearch] = useState("");
  const [cat,setCat] = useState("All");
  const [modal,setModal] = useState(false);
  const cats = ["All",...new Set(TESTS.map(function(t){return t.cat;}))];
  const filtered = TESTS.filter(function(t) {
    return (cat==="All"||t.cat===cat)&&(t.name.toLowerCase().includes(search.toLowerCase())||t.cat.toLowerCase().includes(search.toLowerCase()));
  });
  const inCart = function(id){return cart.find(function(c){return c.id===id;});};
  const toggle = function(t){setCart(function(prev){return inCart(t.id)?prev.filter(function(c){return c.id!==t.id;}):[...prev,t];});};
  const total = cart.reduce(function(s,t){return s+t.price;},0);

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,flexWrap:"wrap",gap:12}},
      React.createElement("div",null,
        React.createElement("h2",{style:{margin:0,fontSize:24,color:"#0A1628"}},"Book Diagnostic Tests"),
        React.createElement("p",{style:{margin:"4px 0 0",color:"#8A9BB0",fontSize:13}},"Select tests · Add to cart · Confirm booking")
      ),
      cart.length>0&&React.createElement(Card,{style:{padding:"14px 18px",display:"flex",alignItems:"center",gap:16,border:"2px solid #0D8A89"}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:12,color:"#8A9BB0"}},cart.length+" test(s)"),
          React.createElement("div",{style:{fontSize:20,fontWeight:800,color:"#0D8A89"}},"₹"+total)
        ),
        React.createElement(Btn,{variant:"gold",onClick:function(){setModal(true);}},"Book Now")
      )
    ),
    React.createElement("div",{style:{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}},
      React.createElement("input",{value:search,onChange:function(e){setSearch(e.target.value);},placeholder:"🔍  Search tests...",style:{flex:1,minWidth:180,padding:"9px 14px",borderRadius:9,border:"1.5px solid #D4DCE8",fontSize:14,outline:"none",fontFamily:"inherit",background:"#fff"}}),
      React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
        cats.map(function(c) {
          return React.createElement("button",{key:c,onClick:function(){setCat(c);},style:{padding:"7px 13px",borderRadius:7,border:"1.5px solid "+(cat===c?"#0D8A89":"#D4DCE8"),background:cat===c?"#E5F7F7":"#fff",color:cat===c?"#0D8A89":"#4A5D72",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}},c);
        })
      )
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}},
      filtered.map(function(t) {
        const sel = inCart(t.id);
        return React.createElement(Card,{key:t.id,onClick:function(){toggle(t);},style:{padding:18,border:"2px solid "+(sel?"#0D8A89":"#D4DCE8"),background:sel?"#E5F7F7":"#fff",cursor:"pointer"}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:8}},
            React.createElement(Badge,{label:t.cat,color:"#0D8A89"}),
            React.createElement(Badge,{label:t.eta,color:"#D4A843"})
          ),
          React.createElement("div",{style:{fontWeight:700,fontSize:14,color:"#0A1628",margin:"8px 0 3px"}},t.name),
          t.fasting&&React.createElement("div",{style:{fontSize:11,color:"#E07B12",marginBottom:6}},"⚠️ Fasting required"),
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}},
            React.createElement("div",{style:{fontSize:20,fontWeight:800,color:sel?"#0D8A89":"#0A1628"}},"₹"+t.price),
            React.createElement("div",{style:{width:26,height:26,borderRadius:"50%",border:"2px solid "+(sel?"#0D8A89":"#D4DCE8"),background:sel?"#0D8A89":"#fff",display:"flex",alignItems:"center",justifyContent:"center",color:sel?"#fff":"#8A9BB0",fontSize:15,fontWeight:700}},sel?"✓":"+")
          )
        );
      })
    ),
    modal&&React.createElement(Modal,{title:"Confirm Booking",onClose:function(){setModal(false);}},
      cart.map(function(t) {
        return React.createElement("div",{key:t.id,style:{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #EDF1F5"}},
          React.createElement("span",{style:{fontSize:14,color:"#0A1628"}},t.name),
          React.createElement("span",{style:{fontWeight:700}},"₹"+t.price)
        );
      }),
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",padding:"12px 0",fontWeight:800,fontSize:17}},
        React.createElement("span",null,"Total"),
        React.createElement("span",{style:{color:"#0D8A89"}},"₹"+total)
      ),
      React.createElement("div",{style:{display:"flex",gap:10,marginTop:4}},
        React.createElement(Btn,{full:true,onClick:function(){setModal(false);setCart([]);}},"Confirm & Pay Later"),
        React.createElement(Btn,{variant:"ghost",full:true,onClick:function(){setModal(false);}},"Cancel")
      )
    )
  );
}

function PatientBilling({patient}) {
  const bills = [
    {id:"INV2025001",date:"2025-03-28",tests:["CBC","LFT"],amount:1000,paid:true,mode:"UPI"},
    {id:"INV2025002",date:"2025-03-20",tests:["TSH"],amount:800,paid:false,mode:"—"},
  ];
  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 6px",fontSize:24,color:"#0A1628"}},"Billing & Payments"),
    React.createElement("p",{style:{margin:"0 0 22px",color:"#8A9BB0",fontSize:13}},"View invoices and make payments"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:22}},
      React.createElement(Stat,{icon:"✅",label:"Total Paid",value:"₹1,000",color:"#198754"}),
      React.createElement(Stat,{icon:"⏳",label:"Pending",value:"₹800",color:"#DC3545"}),
      React.createElement(Stat,{icon:"🧾",label:"Invoices",value:bills.length,color:"#0D8A89"})
    ),
    React.createElement(Card,{style:{padding:22}},
      React.createElement("h3",{style:{margin:"0 0 16px",fontSize:15,color:"#0A1628"}},"Invoice History"),
      bills.map(function(b) {
        return React.createElement("div",{key:b.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:"1px solid #EDF1F5",flexWrap:"wrap",gap:8}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontWeight:700,fontSize:14,color:"#0A1628"}},b.id),
            React.createElement("div",{style:{fontSize:12,color:"#8A9BB0",marginTop:3}},b.date+" · "+b.tests.join(", "))
          ),
          React.createElement("div",{style:{display:"flex",gap:10,alignItems:"center"}},
            React.createElement("div",{style:{fontSize:18,fontWeight:800,color:"#0A1628"}},"₹"+b.amount),
            React.createElement(Badge,{label:b.paid?"Paid":"Due",color:b.paid?"#198754":"#DC3545"}),
            !b.paid&&React.createElement(Btn,{small:true,variant:"danger"},"Pay Now"),
            b.paid&&React.createElement(Btn,{small:true,variant:"ghost"},"Receipt")
          )
        );
      })
    )
  );
}

function PatientReports({patient}) {
  const reports = [
    {id:"R001",test:"CBC",date:"2025-03-28",status:"Ready"},
    {id:"R002",test:"LFT",date:"2025-03-20",status:"Ready"},
  ];
  return React.createElement("div",null,
    React.createElement("h2",{style:{margin:"0 0 22px",fontSize:24,color:"#0A1628"}},"My Reports"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}},
      reports.map(function(r) {
        return React.createElement(Card,{key:r.id,style:{padding:22}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:10}},
            React.createElement("span",{style:{fontWeight:700,fontSize:15,color:"#0A1628"}},r.test),
            React.createElement(Badge,{label:r.status,color:"#198754"})
          ),
          React.createElement("div",{style:{fontSize:12,color:"#8A9BB0",marginBottom:14}},r.date),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement(Btn,{small:true},"View"),
            React.createElement(Btn,{small:true,variant:"outline"},"Download")
          )
        );
      })
    )
  );
}

function PatientProfile({patient}) {
  const [editing,setEditing] = useState(false);
  const [info,setInfo] = useState({...patient});
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}},
      React.createElement("h2",{style:{margin:0,fontSize:24,color:"#0A1628"}},"My Profile"),
      React.createElement(Btn,{variant:editing?"outline":"primary",onClick:function(){setEditing(!editing);}},editing?"Cancel":"✏️ Edit")
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}},
      React.createElement(Card,{style:{padding:24}},
        React.createElement("div",{style:{display:"flex",gap:14,alignItems:"center",marginBottom:20}},
          React.createElement("div",{style:{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#0D8A89,#0A1628)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:"#fff",fontWeight:700}},info.name[0]),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:17,fontWeight:700,color:"#0A1628"}},info.name),
            React.createElement("div",{style:{fontSize:12,color:"#8A9BB0"}},patient.id),
            React.createElement(Badge,{label:"Blood: "+info.blood,color:"#DC3545"})
          )
        ),
        ["name","age","gender","blood"].map(function(k) {
          return React.createElement("div",{key:k,style:{marginBottom:14}},
            React.createElement("div",{style:{fontSize:10,color:"#8A9BB0",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}},k),
            editing
              ?React.createElement("input",{value:info[k],onChange:function(e){setInfo({...info,[k]:e.target.value});},style:{width:"100%",padding:"8px 11px",border:"1.5px solid #0D8A89",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}})
              :React.createElement("div",{style:{fontSize:14,fontWeight:600,color:"#0A1628"}},info[k])
          );
        }),
        editing&&React.createElement(Btn,{full:true,onClick:function(){setEditing(false);},"style":{marginTop:8}},"Save Changes")
      ),
      React.createElement(Card,{style:{padding:24}},
        React.createElement("h4",{style:{margin:"0 0 14px",color:"#4A5D72",fontSize:12,textTransform:"uppercase",letterSpacing:0.6}},"Contact Info"),
        ["phone","email","address"].map(function(k) {
          return React.createElement("div",{key:k,style:{marginBottom:14}},
            React.createElement("div",{style:{fontSize:10,color:"#8A9BB0",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}},k),
            React.createElement("div",{style:{fontSize:14,fontWeight:600,color:"#0A1628"}},info[k]||"—")
          );
        })
      )
    )
  );
}

function FamilyMembers({patient}) {
  const [members,setMembers] = useState([
    {id:"FAM001",name:"Priya Kumar",relation:"Wife",age:38,blood:"O+"},
    {id:"FAM002",name:"Rohan Kumar",relation:"Son",age:14,blood:"B+"},
  ]);
  const [modal,setModal] = useState(false);
  const [form,setForm] = useState({name:"",relation:"",age:"",blood:"A+"});

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}},
      React.createElement("h2",{style:{margin:0,fontSize:24,color:"#0A1628"}},"Family Members"),
      React.createElement(Btn,{onClick:function(){setModal(true);}},"+ Add Member")
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}},
      members.map(function(m) {
        return React.createElement(Card,{key:m.id,style:{padding:22}},
          React.createElement("div",{style:{display:"flex",gap:14,alignItems:"center",marginBottom:14}},
            React.createElement("div",{style:{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#0D8A89,#0A1628)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:20,fontWeight:700}},m.name[0]),
            React.createElement("div",null,
              React.createElement("div",{style:{fontWeight:700,fontSize:15,color:"#0A1628"}},m.name),
              React.createElement("div",{style:{fontSize:12,color:"#8A9BB0"}},m.relation+" · "+m.age+" yrs")
            )
          ),
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            React.createElement(Badge,{label:"Blood: "+m.blood,color:"#DC3545"}),
            React.createElement(Btn,{small:true,variant:"outline"},"Book Test")
          )
        );
      })
    ),
    modal&&React.createElement(Modal,{title:"Add Family Member",onClose:function(){setModal(false);}},
      React.createElement(Inp,{label:"Full Name",value:form.name,onChange:function(e){setForm({...form,name:e.target.value});},placeholder:"Member name"}),
      React.createElement(Sel,{label:"Relation",value:form.relation,onChange:function(e){setForm({...form,relation:e.target.value});}},
        ["","Spouse","Father","Mother","Son","Daughter","Sibling","Other"].map(function(r){return React.createElement("option",{key:r},r);})
      ),
      React.createElement(Inp,{label:"Age",type:"number",value:form.age,onChange:function(e){setForm({...form,age:e.target.value});}}),
      React.createElement(Sel,{label:"Blood Group",value:form.blood,onChange:function(e){setForm({...form,blood:e.target.value});}},
        ["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(function(b){return React.createElement("option",{key:b},b);})
      ),
      React.createElement("div",{style:{display:"flex",gap:10,marginTop:4}},
        React.createElement(Btn,{full:true,onClick:function(){setMembers(function(prev){return [...prev,{id:"FAM"+Date.now(),...form}];});setModal(false);}},"Add Member"),
        React.createElement(Btn,{variant:"ghost",full:true,onClick:function(){setModal(false);}},"Cancel")
      )
    )
  );
}

function NotificationsPage({notifs,setNotifs}) {
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}},
      React.createElement("h2",{style:{margin:0,fontSize:24,color:"#0A1628"}},"Notifications"),
      React.createElement(Btn,{small:true,variant:"ghost",onClick:function(){setNotifs(function(prev){return prev.map(function(n){return {...n,read:true};});});}},"Mark all read")
    ),
    React.createElement(Card,{style:{padding:"0 22px"}},
      notifs.map(function(n,i) {
        return React.createElement("div",{key:n.id,onClick:function(){setNotifs(function(prev){return prev.map(function(x){return x.id===n.id?{...x,read:true}:x;});});},style:{display:"flex",gap:14,alignItems:"flex-start",padding:"14px 0",borderBottom:i<notifs.length-1?"1px solid #EDF1F5":"none",cursor:"pointer"}},
          React.createElement("div",{style:{fontSize:24,flexShrink:0}},{report:"📄",billing:"💳",collect:"🚗",reminder:"⏰"}[n.type]||"📌"),
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{fontSize:14,color:"#0A1628",fontWeight:n.read?400:600}},n.msg),
            React.createElement("div",{style:{fontSize:11,color:"#8A9BB0",marginTop:4}},n.time)
          ),
          !n.read&&React.createElement("div",{style:{width:9,height:9,borderRadius:"50%",background:"#0D8A89",marginTop:6,flexShrink:0}})
        );
      })
    )
  );
}
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
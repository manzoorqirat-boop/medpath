/* MedPath LIS — Patient Portal + Admin Dashboard */

function PatientApp({user,onLogout}) {
  const [active,setActive]=useState("dashboard");
  const [cart,setCart]=useState([]);
  const [tests,setTests]=useState([]);
  const [samples,setSamples]=useState([]);
  const [bills,setBills]=useState([]);
  const [expanded,setExpanded]=useState(null);
  const [paramSelections,setParamSelections]=useState({});
  const nav=[
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"tests",icon:"🧪",label:"Book Tests"},
    {id:"reports",icon:"📄",label:"Reports"},
    {id:"billing",icon:"💳",label:"Billing"},
    {id:"profile",icon:"👤",label:"Profile"},
  ];
  const total=cart.reduce((s,t)=>s+Number(t.price),0);

  useEffect(()=>{
    api("GET","/api/tests").then(d=>{if(d.tests)setTests(d.tests);});
    if(user.patientId){
      api("GET","/api/samples?limit=10").then(d=>{if(d.samples)setSamples(d.samples);});
      api("GET","/api/billing").then(d=>{if(d.invoices)setBills(d.invoices);});
    }
  },[]);

  async function bookTests() {
    if(!cart.length)return;
    if(!user.patientId){alert("Patient ID not found. Please contact reception.");return;}
    const bookings=cart.map(t=>t._booking||{test_id:t.id,mode:"full",selected_param_ids:[]});
    const data=await api("POST","/api/samples",{patient_id:user.patientId,bookings,priority:"Normal",collection_type:"Walk-in"});
    if(data.sample){
      setSamples(prev=>[data.sample,...prev]);
      setCart([]);setParamSelections({});setExpanded(null);
      api("GET","/api/billing").then(d=>{if(d.invoices)setBills(d.invoices);});
      alert("Tests booked! Sample: "+data.sample.sample_no);
    }
    else alert("Error: "+(data.error||"Booking failed"));
  }
  async function payOnline(inv) {
    const order=await api("POST","/api/billing/"+inv.id+"/initiate-payment",{});
    if(order.error){alert("Payment failed: "+order.error);return;}
    try{
      const rzp=new window.Razorpay({
        key:order.key_id,amount:order.amount,currency:order.currency||"INR",
        name:"MedPath LIS",description:"Invoice "+inv.invoice_no,order_id:order.order_id,
        handler:async function(response){
          const v=await api("POST","/api/billing/"+inv.id+"/verify-payment",response);
          if(v.invoice){setBills(prev=>prev.map(b=>b.id===inv.id?v.invoice:b));alert("Payment successful!");}
          else alert("Verification failed. Contact reception.");
        },
        prefill:{name:user.name||"",contact:user.phone||""},
        theme:{color:"#0A5C47"},
      });
      rzp.open();
    }catch(e){alert("Razorpay not available. Contact reception.");}
  }

  function Dashboard() {
    const ready=samples.filter(s=>s.status==="Reported"||s.status==="Dispatched").length;
    const pending=bills.filter(b=>!b.paid).reduce((s,b)=>s+Number(b.total),0);
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},(function(){const hr=new Date().getHours();const g=hr<12?"Good morning":hr<17?"Good afternoon":hr<21?"Good evening":"Good night";return g+", "+user.name.split(" ")[0]+" 👋";})()),
        h("div",{className:"page-sub"},"patient · "+new Date().toDateString().toLowerCase())
      ),
      h("div",{className:"stat-grid"},
        [{label:"Tests Booked",val:samples.length,cls:""},
         {label:"Reports Ready",val:ready,cls:"ok",c:"teal"},
         {label:"Pending (₹)",val:pending,cls:"warn",c:"gold"},
         {label:"In Cart",val:cart.length,cls:"",c:""},
        ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
          h("div",{className:"stat-label"},s.label),
          h("div",{className:"stat-val "+(s.cls||"")},s.val)
        ))
      ),
      h("div",{className:"card"},
        h("div",{className:"section-title"},"Quick Actions"),
        nav.filter(n=>n.id!=="dashboard"&&n.id!=="profile").map(n=>
          h("div",{key:n.id,className:"row",style:{cursor:"pointer"},onClick:()=>setActive(n.id)},
            h("div",{style:{display:"flex",alignItems:"center",gap:12}},
              h("div",{className:"avatar",style:{fontSize:16}},n.icon),
              h("div",null,
                h("div",{style:{fontWeight:500,fontSize:14,color:"var(--t1)"}},n.label),
                h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},n.id+".medpath.in")
              )
            ),
            h("div",{style:{color:"var(--p)",fontSize:18}},"›")
          )
        )
      )
    );
  }

  function Tests() {
    const [search,setSearch]=useState("");

    const getSelection=testId=>paramSelections[testId]||{mode:"full",selectedParamIds:[]};
    const inCart=id=>cart.find(c=>c.id===id);

    function getCartPrice(t) {
      const sel=getSelection(t.id);
      if(sel.mode==="full"||!sel.selectedParamIds.length) return Number(t.price);
      const params=(t.parameters||[]).filter(p=>sel.selectedParamIds.includes(p.id));
      const paramTotal=params.reduce((s,p)=>s+Number(p.price||0),0);
      return paramTotal>0?paramTotal:Number(t.price);
    }
    function toggleCart(t) {
      if(inCart(t.id)){setCart(prev=>prev.filter(c=>c.id!==t.id));}
      else{
        const sel=getSelection(t.id);
        const price=getCartPrice(t);
        setCart(prev=>[...prev,{...t,price,_booking:{test_id:t.id,mode:sel.mode,selected_param_ids:sel.selectedParamIds}}]);
      }
    }
    function toggleParam(testId,paramId){
      setParamSelections(prev=>{
        const cur=prev[testId]||{mode:"params",selectedParamIds:[]};
        const ids=cur.selectedParamIds.includes(paramId)?cur.selectedParamIds.filter(i=>i!==paramId):[...cur.selectedParamIds,paramId];
        return {...prev,[testId]:{mode:ids.length?"params":"full",selectedParamIds:ids}};
      });
      setCart(prev=>prev.filter(c=>c.id!==testId));
    }
    function selectAll(t){
      setParamSelections(prev=>({...prev,[t.id]:{mode:"full",selectedParamIds:[]}}));
      setCart(prev=>prev.filter(c=>c.id!==t.id));
    }

    const cartTotal=cart.reduce((s,t)=>s+Number(t.price),0);
    const filtered=tests.filter(t=>t.name.toLowerCase().includes(search.toLowerCase())||t.category.toLowerCase().includes(search.toLowerCase()));

    async function bookTests() {
      if(!cart.length)return;
      if(!user.patientId){alert("Patient ID not found. Please contact reception.");return;}
      const bookings=cart.map(t=>t._booking||{test_id:t.id,mode:"full",selected_param_ids:[]});
      const data=await api("POST","/api/samples",{patient_id:user.patientId,bookings,priority:"Normal",collection_type:"Walk-in"});
      if(data.sample){setSamples(prev=>[data.sample,...prev]);setCart([]);alert("Tests booked! Sample: "+data.sample.sample_no);}
      else alert("Error: "+(data.error||"Booking failed"));
    }

    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Book Tests"),
        h("div",{className:"page-sub"},"select full test or individual parameters")
      ),
      cart.length>0&&h("div",{className:"cart-bar"},
        h("div",null,
          h("div",{style:{fontSize:11,opacity:.7,fontFamily:"var(--mono)",letterSpacing:".04em"}},cart.length+" TEST(S) IN CART"),
          h("div",{style:{fontFamily:"var(--serif)",fontSize:20}},"Rs."+cartTotal.toFixed(0))
        ),
        h("button",{onClick:bookTests,className:"btn",style:{background:"#fff",color:"var(--p)",fontWeight:600,padding:"8px 18px",flexShrink:0}},"Book Now ->")
      ),
      h("div",{className:"search-wrap"},
        h("span",{className:"search-icon"},"🔍"),
        h("input",{value:search,onChange:e=>setSearch(e.target.value),placeholder:"Search tests..."})
      ),
      tests.length===0&&h(Spinner),
      h("div",{style:{display:"flex",flexDirection:"column",gap:10}},
        filtered.map(t=>{
          const sel=getSelection(t.id);
          const inC=inCart(t.id);
          const hasParams=(t.parameters||[]).length>0;
          const isExp=expanded===t.id;
          const cartPrice=getCartPrice(t);
          const selectedCount=sel.selectedParamIds.length;
          return h("div",{key:t.id,className:"card",style:{padding:"14px 16px",border:inC?"2px solid var(--p)":"1px solid var(--b2)"}},
            h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}},
              h("div",{style:{flex:1}},
                h("div",{style:{fontSize:9.5,fontWeight:600,color:"var(--p-mid)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"var(--mono)",marginBottom:2}},t.category),
                h("div",{style:{fontWeight:600,fontSize:14,color:"var(--t1)",marginBottom:2}},t.name),
                t.fasting_required&&h("div",{style:{fontSize:10,color:"var(--warn)",fontFamily:"var(--mono)"}},"Fasting Required"),
                h("div",{style:{display:"flex",gap:10,alignItems:"center",marginTop:4,flexWrap:"wrap"}},
                  h("div",{style:{fontFamily:"var(--serif)",fontSize:18}},
                    sel.mode==="params"&&selectedCount>0?"Rs."+cartPrice.toFixed(0)+" ("+selectedCount+" params)":"Rs."+t.price
                  ),
                  hasParams&&h("button",{onClick:e=>{e.stopPropagation();setExpanded(isExp?null:t.id);},className:"btn sm",style:{fontSize:11,padding:"3px 10px"}},isExp?"Hide":"Select Params")
                )
              ),
              h("div",{onClick:e=>{e.stopPropagation();toggleCart(t);},style:{width:36,height:36,borderRadius:"50%",background:inC?"var(--p)":"var(--surface2)",border:"2px solid "+(inC?"var(--p)":"var(--b1)"),display:"flex",alignItems:"center",justifyContent:"center",color:inC?"#fff":"var(--t3)",fontSize:18,fontWeight:700,cursor:"pointer",flexShrink:0}},inC?"v":"+")
            ),
            isExp&&hasParams&&h("div",{style:{marginTop:12,paddingTop:12,borderTop:"1px solid var(--b2)"}},
              h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
                h("div",{style:{fontSize:11,fontWeight:600,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase"}},"Choose Parameters"),
                h("button",{onClick:e=>{e.stopPropagation();selectAll(t);},className:"btn sm",style:{fontSize:11}},sel.mode==="full"&&!selectedCount?"Full Test":"Reset to Full")
              ),
              h("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}},
                (t.parameters||[]).map(p=>{
                  const isSel=sel.selectedParamIds.includes(p.id);
                  return h("div",{key:p.id,onClick:e=>{e.stopPropagation();toggleParam(t.id,p.id);},
                    style:{padding:"8px 10px",borderRadius:"var(--r-md)",cursor:"pointer",
                      border:"1.5px solid "+(isSel?"var(--p)":"var(--b2)"),
                      background:isSel?"var(--p-light)":"var(--surface)"}},
                    h("div",{style:{fontSize:12,fontWeight:500,color:isSel?"var(--p)":"var(--t1)"}},p.param_name),
                    p.unit&&h("div",{style:{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}},p.unit),
                    p.price>0&&h("div",{style:{fontSize:11,color:"var(--ok)"}},"+Rs."+p.price)
                  );
                })
              ),
              selectedCount>0&&h("div",{style:{marginTop:8,padding:"6px 10px",background:"var(--p-light)",borderRadius:"var(--r-sm)",fontSize:11,color:"var(--p)",fontFamily:"var(--mono)"}},
                selectedCount+" selected - Rs."+cartPrice.toFixed(0)
              )
            )
          );
        })
      )
    );
  }
  function Reports() {
    const [myReports,setMyReports]=useState([]);
    const [viewId,setViewId]=useState(null);
    const [loadingR,setLoadingR]=useState(true);
    useEffect(()=>{api("GET","/api/reports/my").then(d=>{if(d.reports)setMyReports(d.reports);setLoadingR(false);});},[]);
    if(viewId)return h(ReportViewer,{reportId:viewId,onClose:()=>setViewId(null),showSendActions:false});
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"My Reports"),
        h("div",{className:"page-sub"},"verified lab results & history")
      ),
      loadingR&&h(Spinner),
      !loadingR&&myReports.length===0&&h("div",{className:"card",style:{textAlign:"center",padding:40}},
        h("div",{style:{fontSize:44,marginBottom:10}},"📋"),
        h("div",{style:{color:"var(--t2)",fontSize:14,marginBottom:14}},"No reports yet. Book a test first!"),
        h("button",{onClick:()=>setActive("tests"),className:"btn primary",style:{width:"auto",padding:"9px 22px"}},"Book Tests →")
      ),
      myReports.length>0&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Report No","Test","Date","Status","Actions"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,myReports.map(r=>h("tr",{key:r.id},
              h("td",{style:{fontFamily:"var(--mono)",fontWeight:700,color:"var(--p)",fontSize:12}},r.report_no||"—"),
              h("td",{style:{fontWeight:500}},r.test_name),
              h("td",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},new Date(r.created_at).toLocaleDateString("en-IN")),
              h("td",null,r.is_signed?h(Badge,{label:"Verified",type:"ok"}):h(Badge,{label:"Pending",type:"warn"})),
              h("td",null,h("div",{style:{display:"flex",gap:6}},
                h("button",{onClick:()=>setViewId(r.id),className:"btn sm",style:{background:"var(--p)",color:"#fff",border:"none"}},"View"),
                h("button",{onClick:()=>window.open(API+"/api/reports/"+r.id+"/pdf","_blank"),className:"btn sm teal",style:{color:"#fff"}},"PDF")
              ))
            )))
          )
        )
      )
    );
  }

  function Billing() {
    const [viewInvoice,setViewInvoice]=useState(null);
    const [invoiceItems,setInvoiceItems]=useState([]);
    const paid=bills.filter(b=>b.paid).reduce((s,b)=>s+Number(b.total),0);
    const due=bills.filter(b=>!b.paid).reduce((s,b)=>s+Number(b.total),0);

    useEffect(()=>{
      if(!viewInvoice)return;
      api("GET","/api/billing/"+viewInvoice.id).then(d=>{if(d.items)setInvoiceItems(d.items);});
    },[viewInvoice]);

    if(viewInvoice) return h("div",{className:"fade-in"},
      h("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}},
        h("button",{onClick:()=>{setViewInvoice(null);setInvoiceItems([]);},className:"btn sm"},"Back"),
        h("button",{onClick:()=>window.print(),className:"btn sm"},"Print"),
        h("div",{style:{flex:1}}),
        !viewInvoice.paid&&h("button",{onClick:()=>payOnline(viewInvoice),className:"btn sm",style:{background:"#5B4CF0",color:"#fff",border:"none"}},"Pay Online")
      ),
      h("div",{className:"card"},
        h("div",{style:{background:"linear-gradient(135deg,var(--p),var(--p-mid))",borderRadius:"var(--r-lg)",padding:"18px 20px",color:"#fff",marginBottom:16}},
          h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}},
            h("div",null,
              h("div",{style:{fontSize:18,fontWeight:700}},"MedPath Laboratory"),
              h("div",{style:{fontSize:9,opacity:.7,fontFamily:"var(--mono)",marginTop:3}},"NABL ACCREDITED · ISO 15189")
            ),
            h("div",{style:{textAlign:"right"}},
              h("div",{style:{fontFamily:"var(--mono)",fontSize:9,opacity:.7}},"INVOICE"),
              h("div",{style:{fontFamily:"var(--mono)",fontSize:16,fontWeight:700}},viewInvoice.invoice_no),
              h("div",{style:{fontSize:10,opacity:.7,marginTop:3}},new Date(viewInvoice.created_at).toLocaleDateString("en-IN"))
            )
          )
        ),
        h("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 20px",marginBottom:16}},
          h("div",null,h("div",{style:{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:2}},"Patient"),h("div",{style:{fontWeight:600}},viewInvoice.patient_name||user.name)),
          h("div",null,h("div",{style:{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:2}},"Invoice No"),h("div",{style:{fontWeight:600,color:"var(--p)"}},viewInvoice.invoice_no)),
          h("div",null,h("div",{style:{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:2}},"Date"),h("div",{style:{fontWeight:600}},new Date(viewInvoice.created_at).toLocaleDateString("en-IN"))),
          h("div",null,h("div",{style:{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase",marginBottom:2}},"Status"),h("div",{style:{marginTop:2}},h(Badge,{label:viewInvoice.paid?"PAID":"DUE",type:viewInvoice.paid?"ok":"danger"})))
        ),
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Test / Service","Amount"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,
              invoiceItems.length===0
              ?h("tr",null,h("td",{colSpan:2,style:{textAlign:"center",color:"var(--t3)",padding:20}},"Loading items..."))
              :invoiceItems.map((item,i)=>h("tr",{key:i},
                h("td",{style:{fontWeight:500}},item.test_name),
                h("td",{style:{fontFamily:"var(--serif)",fontSize:15,fontWeight:600}},"Rs."+item.net_price)
              ))
            )
          )
        ),
        h("div",{style:{borderTop:"2px solid var(--b2)",paddingTop:14,marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
          h("div",{style:{fontSize:22,fontFamily:"var(--serif)",fontWeight:700,color:"var(--p)"}},"Total: Rs."+viewInvoice.total),
          !viewInvoice.paid&&h("button",{onClick:()=>payOnline(viewInvoice),className:"btn primary",style:{width:"auto",padding:"10px 24px"}},"Pay Online")
        ),
        viewInvoice.paid&&h("div",{style:{marginTop:12,padding:"10px 14px",background:"var(--p-light)",borderRadius:"var(--r-md)",fontSize:12,color:"var(--p)",fontFamily:"var(--mono)"}},"PAID via "+(viewInvoice.payment_mode||"Online")),
        h("div",{style:{marginTop:16,fontSize:11,color:"var(--t3)",textAlign:"center",fontFamily:"var(--mono)"}},"Thank you for choosing MedPath Laboratory")
      )
    );

    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Billing & Payments"),
        h("div",{className:"page-sub"},"tap invoice number to view details")
      ),
      h("div",{className:"stat-grid",style:{gridTemplateColumns:"repeat(3,1fr)"}},
        [{label:"Paid",val:"Rs."+paid.toFixed(0),cls:"ok",c:""},
         {label:"Outstanding",val:"Rs."+due.toFixed(0),cls:"danger",c:"red"},
         {label:"Invoices",val:bills.length,cls:"",c:""},
        ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
          h("div",{className:"stat-label"},s.label),
          h("div",{className:"stat-val "+(s.cls||"")},s.val)
        ))
      ),
      bills.length===0&&h("div",{className:"card",style:{textAlign:"center",padding:30}},h("p",{style:{color:"var(--t3)"}},"No invoices yet.")),
      bills.length>0&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Invoice","Date","Amount","Status","Actions"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,
              bills.map(b=>h("tr",{key:b.id},
                h("td",null,h("span",{onClick:()=>setViewInvoice(b),style:{fontFamily:"var(--mono)",fontWeight:700,color:"var(--p)",fontSize:12,cursor:"pointer",textDecoration:"underline"}},b.invoice_no)),
                h("td",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},new Date(b.created_at).toLocaleDateString("en-IN")),
                h("td",{style:{fontFamily:"var(--serif)",fontWeight:600}},"Rs."+b.total),
                h("td",null,h(Badge,{label:b.paid?"Paid":"Due",type:b.paid?"ok":"danger"})),
                h("td",null,h("div",{style:{display:"flex",gap:6}},
                  h("button",{onClick:()=>setViewInvoice(b),className:"btn sm"},"View"),
                  !b.paid&&h("button",{onClick:()=>payOnline(b),className:"btn sm",style:{background:"#5B4CF0",color:"#fff",border:"none"}},"Pay Online")
                ))
              ))
            )
          )
        )
      )
    );
  }
  function Profile() {
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"My Profile"),
        h("div",{className:"page-sub"},"account information")
      ),
      h("div",{className:"card",style:{maxWidth:420}},
        h("div",{style:{display:"flex",gap:16,alignItems:"center",marginBottom:22,paddingBottom:18,borderBottom:"1px solid var(--b2)"}},
          h("div",{className:"avatar",style:{width:56,height:56,fontSize:22,fontWeight:700}},user.name?user.name[0]:"P"),
          h("div",null,
            h("div",{style:{fontFamily:"var(--serif)",fontSize:20,color:"var(--t1)"}},user.name),
            h("div",{style:{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)",letterSpacing:".04em",textTransform:"uppercase",marginTop:2}},"Patient · "+(user.patientNo||"—"))
          )
        ),
        [["role","Patient"],["patient no",user.patientNo||"—"],["phone",user.phone||"—"],["email",user.email||"—"]].map(([k,v])=>
          h("div",{key:k,style:{padding:"10px 0",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center"}},
            h("div",{style:{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:".05em"}},k),
            h("div",{style:{fontSize:13,fontWeight:500,color:"var(--t1)"}},v)
          )
        ),
        h("button",{onClick:onLogout,className:"btn danger-sm",style:{width:"100%",marginTop:18,textAlign:"center"}},"Sign Out")
      )
    );
  }

  const pages={dashboard:h(Dashboard),tests:h(Tests),reports:h(Reports),billing:h(Billing),profile:h(Profile)};
  return h(AppShell,{nav,active,setActive,user,onLogout},pages[active]||pages.dashboard);
}
function AdminApp({user,onLogout}) {
  const [active,setActive]=useState("dashboard");
  const [samples,setSamples]=useState([]);
  const [bills,setBills]=useState([]);
  const [stats,setStats]=useState({});
  const nav=[
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"samples",icon:"🔬",label:"Samples"},
    {id:"patients",icon:"👥",label:"Patients"},
    {id:"billing",icon:"💰",label:"Billing"},
    {id:"tests",icon:"🧪",label:"Tests"},
    {id:"users",icon:"👤",label:"Users"},
  ];
  const statusOrder=["Pending","Collected","Processing","Reported","Dispatched"];

  useEffect(()=>{
    api("GET","/api/dashboard").then(d=>{if(d.stats)setStats(d.stats);});
    api("GET","/api/samples?limit=20").then(d=>{if(d.samples)setSamples(d.samples);});
    api("GET","/api/billing?limit=20").then(d=>{if(d.invoices)setBills(d.invoices);});
  },[]);

  async function advanceSample(id,cur) {
    const next=statusOrder[statusOrder.indexOf(cur)+1];
    if(!next) return;
    const data=await api("PATCH","/api/samples/"+id+"/status",{status:next});
    if(data.sample)setSamples(prev=>prev.map(s=>s.id===id?{...s,status:next}:s));
  }
  async function markPaid(id) {
    const data=await api("PATCH","/api/billing/"+id+"/pay",{payment_mode:"Manual"});
    if(data.invoice)setBills(prev=>prev.map(b=>b.id===id?data.invoice:b));
  }

  function Dashboard() {
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Admin Dashboard"),
        h("div",{className:"page-sub"},"admin · "+new Date().toDateString().toLowerCase())
      ),
      h("div",{className:"stat-grid"},
        [{label:"Today Samples",val:stats.today_samples||0,cls:"",c:""},
         {label:"Total Patients",val:stats.total_patients||0,cls:"teal",c:"teal"},
         {label:"Pending",val:stats.pending_samples||0,cls:"warn",c:"gold"},
         {label:"Home Today",val:stats.home_today||0,cls:"",c:""},
        ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
          h("div",{className:"stat-label"},s.label),
          h("div",{className:"stat-val "+(s.cls||"")},s.val)
        ))
      ),
      h("div",{className:"card"},
        h("div",{className:"section-title"},"Recent Samples"),
        samples.length===0&&h(Spinner),
        samples.slice(0,6).map(s=>h("div",{key:s.id,className:"row"},
          h("div",{style:{display:"flex",alignItems:"center",gap:12}},
            h("div",{className:"avatar"},s.patient_name?s.patient_name[0]:"P"),
            h("div",null,
              h("div",{style:{fontWeight:500,fontSize:13,color:"var(--t1)"}},s.patient_name||"Patient"),
              h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},s.sample_no+" · "+(s.test_codes||[]).join(", "))
            )
          ),
          h(Badge,{label:s.status,type:statusType(s.status)})
        ))
      )
    );
  }

  function Samples() {
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Sample Tracking"),
        h("div",{className:"page-sub"},"advance sample status through workflow")
      ),
      samples.length===0&&h(Spinner),
      h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("table",{className:"glass-table"},
          h("thead",null,h("tr",null,["Sample No","Patient","Tests","Status","Priority","Action"].map(c=>h("th",{key:c},c)))),
          h("tbody",null,
            samples.map(s=>h("tr",{key:s.id},
              h("td",{style:{fontFamily:"var(--mono)",fontWeight:600,color:"var(--p)",fontSize:12}},s.sample_no),
              h("td",{style:{fontWeight:500,color:"var(--t1)"}},s.patient_name||"—"),
              h("td",{style:{fontSize:12,color:"var(--t2)"}},(s.test_codes||[]).join(", ")),
              h("td",null,h("div",null,h(Badge,{label:s.status,type:statusType(s.status)}),h("div",{style:{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}},statusLabel(s.status)))),
              h("td",null,h(Badge,{label:s.priority||"Normal",type:s.priority==="Urgent"?"danger":"gray"})),
              h("td",null,
                s.status!=="Dispatched"&&s.status!=="Cancelled"&&
                h("button",{onClick:()=>advanceSample(s.id,s.status),className:"btn sm"},"Advance →")
              )
            ))
          )
        )
      )
    );
  }

  function Patients() {
    const [patients,setPatients]=useState([]);
    const [loading,setLoading]=useState(true);
    useEffect(()=>{api("GET","/api/patients?limit=30").then(d=>{if(d.patients)setPatients(d.patients);setLoading(false);});},[]);
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Patients"),
        h("div",{className:"page-sub"},patients.length+" registered patients")
      ),
      loading&&h(Spinner),
      h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("table",{className:"glass-table"},
          h("thead",null,h("tr",null,["Patient No","Name","Age","Blood","Phone","Registered"].map(c=>h("th",{key:c},c)))),
          h("tbody",null,
            patients.map(p=>h("tr",{key:p.id},
              h("td",{style:{fontFamily:"var(--mono)",color:"var(--p)",fontWeight:600,fontSize:12}},p.patient_no),
              h("td",null,
                h("div",{style:{display:"flex",alignItems:"center",gap:10}},
                  h("div",{className:"avatar",style:{width:28,height:28,fontSize:11}},p.name?p.name[0]:"P"),
                  h("div",{style:{fontWeight:500,fontSize:13}},p.name)
                )
              ),
              h("td",{style:{fontSize:12,color:"var(--t2)"}},(p.date_of_birth?new Date().getFullYear()-new Date(p.date_of_birth).getFullYear()+"yr":"—")),
              h("td",null,p.blood_group&&h(Badge,{label:p.blood_group,type:"danger"})),
              h("td",{style:{fontFamily:"var(--mono)",fontSize:12,color:"var(--t2)"}},p.phone||"—"),
              h("td",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)"}},new Date(p.created_at).toLocaleDateString())
            ))
          )
        )
      )
    );
  }

  function Billing() {
    const total=bills.reduce((s,b)=>s+Number(b.total),0);
    const collected=bills.filter(b=>b.paid).reduce((s,b)=>s+Number(b.total),0);
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Billing Overview"),
        h("div",{className:"page-sub"},"revenue and payment tracking")
      ),
      h("div",{className:"stat-grid"},
        [{label:"Total Revenue",val:"₹"+total,cls:"",c:""},
         {label:"Collected",val:"₹"+collected,cls:"ok",c:"teal"},
         {label:"Outstanding",val:"₹"+(total-collected),cls:"danger",c:"red"},
         {label:"Invoices",val:bills.length,cls:"",c:""},
        ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
          h("div",{className:"stat-label"},s.label),
          h("div",{className:"stat-val "+(s.cls||"")},s.val)
        ))
      ),
      h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("table",{className:"glass-table"},
          h("thead",null,h("tr",null,["Invoice","Patient","Amount","Status","Action"].map(c=>h("th",{key:c},c)))),
          h("tbody",null,
            bills.map(b=>h("tr",{key:b.id},
              h("td",{style:{fontFamily:"var(--mono)",fontWeight:600,color:"var(--p)",fontSize:12}},b.invoice_no),
              h("td",{style:{fontWeight:500,fontSize:13}},b.patient_name||"—"),
              h("td",{style:{fontFamily:"var(--serif)",fontSize:16}},"₹"+b.total),
              h("td",null,h(Badge,{label:b.paid?"Paid":"Due",type:b.paid?"ok":"danger"})),
              h("td",null,!b.paid&&h("button",{onClick:()=>markPaid(b.id),className:"btn sm"},"Mark Paid"))
            ))
          )
        )
      )
    );
  }

  function ManageTests() {
    const [tests,setTests]=useState([]);
    const [loading,setLoading]=useState(true);
    const [editing,setEditing]=useState(null);
    const [adding,setAdding]=useState(false);
    const [form,setForm]=useState({name:"",category:"",price:"",turnaround_hrs:"6",fasting_required:false});
    const [paramTest,setParamTest]=useState(null);
    const [params,setParams]=useState([]);
    const [editingParam,setEditingParam]=useState(null);
    const [paramMsg,setParamMsg]=useState("");
    const emptyPF={param_name:"",unit:"",price:"",range_male_min:"",range_male_max:"",range_female_min:"",range_female_max:"",range_text:"",display_order:""};
    const [pf,setPf]=useState(emptyPF);

    useEffect(()=>{api("GET","/api/tests").then(d=>{if(d.tests)setTests(d.tests);setLoading(false);});},[]);

    async function saveEdit(id){
      const d=await api("PUT","/api/tests/"+id,{name:form.name,category:form.category,price:Number(form.price),turnaround_hrs:Number(form.turnaround_hrs),fasting_required:form.fasting_required,is_active:true});
      if(d.test){setTests(prev=>prev.map(t=>t.id===id?d.test:t));setEditing(null);}
      else alert("Update failed.");
    }
    async function addTest(){
      const d=await api("POST","/api/tests",{code:form.name.substring(0,6).toUpperCase().replace(/ /g,""),name:form.name,category:form.category,price:Number(form.price),turnaround_hrs:Number(form.turnaround_hrs)||6,fasting_required:form.fasting_required});
      if(d.test){setTests(prev=>[...prev,d.test]);setAdding(false);setForm({name:"",category:"",price:"",turnaround_hrs:"6",fasting_required:false});}
      else alert("Failed: "+(d.error||"Unknown"));
    }
    async function toggleActive(t){
      const d=await api("PUT","/api/tests/"+t.id,{name:t.name,category:t.category,price:Number(t.price),turnaround_hrs:Number(t.turnaround_hrs),fasting_required:t.fasting_required,is_active:!t.is_active});
      if(d.test)setTests(prev=>prev.map(x=>x.id===t.id?d.test:x));
    }
    async function openParams(t){
      setParamTest(t);setParamMsg("");setEditingParam(null);setPf(emptyPF);
      const d=await api("GET","/api/tests/"+t.id+"/parameters");
      if(d.parameters)setParams(d.parameters);
    }
    async function addParam(){
      if(!pf.param_name){setParamMsg("Parameter name is required.");return;}
      const d=await api("POST","/api/tests/"+paramTest.id+"/parameters",{
        param_name:pf.param_name,unit:pf.unit||null,price:Number(pf.price)||0,
        range_male_min:pf.range_male_min||null,range_male_max:pf.range_male_max||null,
        range_female_min:pf.range_female_min||null,range_female_max:pf.range_female_max||null,
        range_text:pf.range_text||null,display_order:Number(pf.display_order)||params.length
      });
      if(d.parameter){setParams(prev=>[...prev,d.parameter]);setPf(emptyPF);setParamMsg("Parameter added!");}
      else setParamMsg("Error: "+(d.error||"Unknown"));
    }
    async function saveParam(id){
      const d=await api("PUT","/api/tests/parameters/"+id,{
        param_name:pf.param_name,unit:pf.unit||null,price:Number(pf.price)||0,
        range_male_min:pf.range_male_min||null,range_male_max:pf.range_male_max||null,
        range_female_min:pf.range_female_min||null,range_female_max:pf.range_female_max||null,
        range_text:pf.range_text||null,display_order:Number(pf.display_order)||0
      });
      if(d.parameter){setParams(prev=>prev.map(p=>p.id===id?d.parameter:p));setEditingParam(null);setPf(emptyPF);setParamMsg("Updated!");}
      else setParamMsg("Error: "+(d.error||"Unknown"));
    }
    async function deleteParam(id){
      if(!confirm("Delete this parameter?"))return;
      await api("DELETE","/api/tests/parameters/"+id);
      setParams(prev=>prev.filter(p=>p.id!==id));setParamMsg("Deleted.");
    }
    function startEdit(p){setEditingParam(p.id);setPf({param_name:p.param_name||"",unit:p.unit||"",price:p.price||"",range_male_min:p.range_male_min||"",range_male_max:p.range_male_max||"",range_female_min:p.range_female_min||"",range_female_max:p.range_female_max||"",range_text:p.range_text||"",display_order:p.display_order||""});}

    if(paramTest) return h("div",{className:"fade-in"},
      h("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:18}},
        h("button",{onClick:()=>setParamTest(null),className:"btn sm"},"Back"),
        h("div",null,
          h("div",{className:"page-title"},paramTest.name),
          h("div",{className:"page-sub"},"parameters & reference ranges")
        )
      ),
      paramMsg&&h("div",{className:"alert "+(paramMsg.includes("Error")?"alert-err":"alert-ok")},paramMsg),
      h("div",{className:"card",style:{border:"2px solid var(--p-light)",marginBottom:16}},
        h("div",{className:"section-title"},editingParam?"Edit Parameter":"Add New Parameter"),
        h("div",{className:"form-grid"},
          h("div",{className:"form-group"},h("label",null,"Parameter Name *"),h("input",{value:pf.param_name,onChange:e=>setPf({...pf,param_name:e.target.value}),placeholder:"e.g. Serum Creatinine"})),
          h("div",{className:"form-group"},h("label",null,"Unit"),h("input",{value:pf.unit,onChange:e=>setPf({...pf,unit:e.target.value}),placeholder:"e.g. mg/dL"})),
          h("div",{className:"form-group"},h("label",null,"Price (Rs.) — 0 = use test price"),h("input",{type:"number",value:pf.price||"",onChange:e=>setPf({...pf,price:e.target.value}),placeholder:"0"})),
          h("div",{className:"form-group"},h("label",null,"Male Min"),h("input",{type:"number",value:pf.range_male_min,onChange:e=>setPf({...pf,range_male_min:e.target.value}),placeholder:"0.7"})),
          h("div",{className:"form-group"},h("label",null,"Male Max"),h("input",{type:"number",value:pf.range_male_max,onChange:e=>setPf({...pf,range_male_max:e.target.value}),placeholder:"1.2"})),
          h("div",{className:"form-group"},h("label",null,"Female Min"),h("input",{type:"number",value:pf.range_female_min,onChange:e=>setPf({...pf,range_female_min:e.target.value}),placeholder:"0.5"})),
          h("div",{className:"form-group"},h("label",null,"Female Max"),h("input",{type:"number",value:pf.range_female_max,onChange:e=>setPf({...pf,range_female_max:e.target.value}),placeholder:"1.0"})),
          h("div",{className:"form-group"},h("label",null,"Display Range Text"),h("input",{value:pf.range_text,onChange:e=>setPf({...pf,range_text:e.target.value}),placeholder:"0.7-1.2 (M), 0.5-1.0 (F)"})),
          h("div",{className:"form-group"},h("label",null,"Display Order"),h("input",{type:"number",value:pf.display_order,onChange:e=>setPf({...pf,display_order:e.target.value}),placeholder:"1"}))
        ),
        h("div",{style:{display:"flex",gap:10}},
          editingParam
          ?h("div",{style:{display:"flex",gap:10,flex:1}},
              h("button",{onClick:()=>saveParam(editingParam),className:"btn primary",style:{flex:1}},"Save Changes"),
              h("button",{onClick:()=>{setEditingParam(null);setPf(emptyPF);},className:"btn",style:{padding:"12px 20px"}},"Cancel")
            )
          :h("button",{onClick:addParam,className:"btn primary",style:{width:"auto",padding:"9px 22px"}},"+ Add Parameter")
        )
      ),
      params.length===0&&h("div",{className:"card",style:{textAlign:"center",padding:28}},
        h("div",{style:{fontSize:32,marginBottom:8}},"🔬"),
        h("p",{style:{color:"var(--t3)",fontSize:13}},"No parameters yet. Add your first parameter above.")
      ),
      params.length>0&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["#","Parameter","Unit","Price","Male Range","Female Range","Display Text","Action"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,
              params.map((p,i)=>h("tr",{key:p.id},
                h("td",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)"}},p.display_order||i+1),
                h("td",{style:{fontWeight:600}},p.param_name),
                h("td",{style:{fontFamily:"var(--mono)",fontSize:11}},p.unit||"—"),
                h("td",{style:{fontFamily:"var(--mono)",fontSize:12,color:"var(--ok)"}},p.price>0?"Rs."+p.price:"—"),
                h("td",{style:{fontFamily:"var(--mono)",fontSize:11}},p.range_male_min!=null&&p.range_male_max!=null?p.range_male_min+"-"+p.range_male_max:"—"),
                h("td",{style:{fontFamily:"var(--mono)",fontSize:11}},p.range_female_min!=null&&p.range_female_max!=null?p.range_female_min+"-"+p.range_female_max:"—"),
                h("td",{style:{fontSize:12,color:"var(--t2)"}},p.range_text||"—"),
                h("td",null,h("div",{style:{display:"flex",gap:5}},
                  h("button",{onClick:()=>startEdit(p),className:"btn sm"},"Edit"),
                  h("button",{onClick:()=>deleteParam(p.id),className:"btn danger-sm"},"Delete")
                ))
              ))
            )
          )
        )
      )
    );

    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}},
          h("div",null,h("div",{className:"page-title"},"Manage Tests"),h("div",{className:"page-sub"},tests.length+" tests")),
          h("button",{onClick:()=>{setAdding(!adding);setForm({name:"",category:"",price:"",turnaround_hrs:"6",fasting_required:false});},className:"btn primary",style:{width:"auto",padding:"9px 20px"}},adding?"Cancel":"+ Add Test")
        )
      ),
      adding&&h("div",{className:"card",style:{border:"2px solid var(--p-light)",marginBottom:16}},
        h("div",{className:"section-title"},"New Test"),
        h("div",{className:"form-grid"},
          h("div",{className:"form-group"},h("label",null,"Test Name *"),h("input",{value:form.name,onChange:e=>setForm({...form,name:e.target.value}),placeholder:"e.g. Complete Blood Count"})),
          h("div",{className:"form-group"},h("label",null,"Category *"),h("input",{value:form.category,onChange:e=>setForm({...form,category:e.target.value}),placeholder:"e.g. Hematology"})),
          h("div",{className:"form-group"},h("label",null,"Price"),h("input",{type:"number",value:form.price,onChange:e=>setForm({...form,price:e.target.value}),placeholder:"350"})),
          h("div",{className:"form-group"},h("label",null,"TAT Hours"),h("input",{type:"number",value:form.turnaround_hrs,onChange:e=>setForm({...form,turnaround_hrs:e.target.value}),placeholder:"6"}))
        ),
        h("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14}},
          h("input",{type:"checkbox",id:"fast",checked:form.fasting_required,onChange:e=>setForm({...form,fasting_required:e.target.checked}),style:{width:"auto"}}),
          h("label",{htmlFor:"fast",style:{margin:0,textTransform:"none",fontSize:13}},"Fasting Required")
        ),
        h("button",{onClick:addTest,className:"btn primary",style:{width:"auto",padding:"9px 22px"}},"Save Test")
      ),
      loading&&h(Spinner),
      h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Name","Category","Price","TAT","Params","Status","Actions"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,
              tests.map(t=>
                editing===t.id
                ?h("tr",{key:t.id,style:{background:"var(--p-light)"}},
                    h("td",{colSpan:7,style:{padding:"12px 16px"}},
                      h("div",{className:"form-grid",style:{marginBottom:10}},
                        h("div",{className:"form-group",style:{marginBottom:0}},h("label",null,"Name"),h("input",{value:form.name,onChange:e=>setForm({...form,name:e.target.value})})),
                        h("div",{className:"form-group",style:{marginBottom:0}},h("label",null,"Category"),h("input",{value:form.category,onChange:e=>setForm({...form,category:e.target.value})})),
                        h("div",{className:"form-group",style:{marginBottom:0}},h("label",null,"Price"),h("input",{type:"number",value:form.price,onChange:e=>setForm({...form,price:e.target.value})})),
                        h("div",{className:"form-group",style:{marginBottom:0}},h("label",null,"TAT"),h("input",{type:"number",value:form.turnaround_hrs,onChange:e=>setForm({...form,turnaround_hrs:e.target.value})}))
                      ),
                      h("div",{style:{display:"flex",gap:10,alignItems:"center"}},
                        h("div",{style:{display:"flex",alignItems:"center",gap:8,flex:1}},
                          h("input",{type:"checkbox",checked:form.fasting_required,onChange:e=>setForm({...form,fasting_required:e.target.checked}),style:{width:"auto"}}),
                          h("span",{style:{fontSize:13}},"Fasting")
                        ),
                        h("button",{onClick:()=>saveEdit(t.id),className:"btn sm",style:{background:"var(--p)",color:"#fff",border:"none"}},"Save"),
                        h("button",{onClick:()=>setEditing(null),className:"btn sm"},"Cancel")
                      )
                    )
                  )
                :h("tr",{key:t.id,style:{opacity:t.is_active?1:0.5}},
                    h("td",{style:{fontWeight:500}},t.name),
                    h("td",null,h(Badge,{label:t.category,type:"info"})),
                    h("td",{style:{fontFamily:"var(--serif)",fontSize:15}},"Rs."+t.price),
                    h("td",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)"}},t.turnaround_hrs+"h"),
                    h("td",null,h(Badge,{label:(t.parameters||[]).length+" params",type:(t.parameters||[]).length>0?"ok":"warn"})),
                    h("td",null,h(Badge,{label:t.is_active?"Active":"Inactive",type:t.is_active?"ok":"gray"})),
                    h("td",null,
                      h("div",{style:{display:"flex",gap:5,flexWrap:"wrap"}},
                        h("button",{onClick:()=>openParams(t),className:"btn sm",style:{background:"var(--teal)",color:"#fff",border:"none",fontSize:11}},"Params"),
                        h("button",{onClick:()=>{setEditing(t.id);setForm({name:t.name,category:t.category,price:t.price,turnaround_hrs:t.turnaround_hrs,fasting_required:t.fasting_required});},className:"btn sm",style:{fontSize:11}},"Edit"),
                        h("button",{onClick:()=>toggleActive(t),className:"btn sm "+(t.is_active?"danger-sm":""),style:{fontSize:11}},t.is_active?"Disable":"Enable")
                      )
                    )
                  )
              )
            )
          )
        )
      )
    );
  }

  function UsersManagement() {
    const [tab,setTab]=useState("staff");
    const [staff,setStaff]=useState([]);
    const [loadingS,setLoadingS]=useState(true);
    const [showStaff,setShowStaff]=useState(false);
    const [showPat,setShowPat]=useState(false);
    const [editUser,setEditUser]=useState(null);
    const [sf,setSf]=useState({name:"",username:"",email:"",phone:"",role:"technician",designation:"",department:"",qualification:"",account_expires_at:""});
    const [pf,setPf]=useState({name:"",phone:"",email:"",dob:"",gender:"",blood_group:"",address:""});
    const [saving,setSaving]=useState(false);
    const [msg,setMsg]=useState("");
    const [tempPwdMsg,setTempPwdMsg]=useState("");
    const [auditLogs,setAuditLogs]=useState([]);
    const [auditLoading,setAuditLoading]=useState(false);
    const [settings,setSettings]=useState({});
    const [savingSettings,setSavingSettings]=useState(false);
    const [auditFilter,setAuditFilter]=useState({category:"",from:"",to:""});

    useEffect(()=>{loadStaff();},[]);
    useEffect(()=>{if(tab==="audit")loadAudit();if(tab==="settings")loadSettings();},[tab]);

    async function loadStaff(){
      setLoadingS(true);
      const d=await api("GET","/api/staff");
      if(d.staff)setStaff(d.staff);
      setLoadingS(false);
    }
    async function loadAudit(){
      setAuditLoading(true);
      const params=new URLSearchParams();
      if(auditFilter.category)params.set("category",auditFilter.category);
      if(auditFilter.from)params.set("from",auditFilter.from);
      if(auditFilter.to)params.set("to",auditFilter.to);
      const d=await api("GET","/api/staff/audit/log?"+(params.toString()));
      if(d.logs)setAuditLogs(d.logs);
      setAuditLoading(false);
    }
    async function loadSettings(){
      const d=await api("GET","/api/staff/settings/all");
      if(d.settings){
        const s={};
        d.settings.forEach(r=>{s[r.key]=r.value;});
        setSettings(s);
      }
    }
    async function saveSettings(){
      setSavingSettings(true);
      const d=await api("PATCH","/api/staff/settings",{settings});
      setSavingSettings(false);
      if(d.message)setMsg("Settings saved!");
      else setMsg("Error: "+(d.error||"Unknown"));
    }
    async function createStaff(){
      if(!sf.name||!sf.username||!sf.designation){setMsg("Name, username and designation required.");return;}
      setSaving(true);setMsg("");setTempPwdMsg("");
      const d=await api("POST","/api/staff",sf);
      setSaving(false);
      if(d.staff){
        setStaff(prev=>[d.staff,...prev]);
        setShowStaff(false);
        setSf({name:"",email:"",phone:"",role:"technician",designation:"",department:"",qualification:"",account_expires_at:""});
        setTempPwdMsg(d.message||"");
        setMsg("Staff created successfully!");
      } else setMsg("Error: "+(d.error||"Unknown"));
    }
    async function createPat(){
      if(!pf.name||!pf.phone){setMsg("Name and phone required.");return;}
      setSaving(true);setMsg("");
      const d=await api("POST","/api/patients",{name:pf.name,phone:pf.phone,email:pf.email||undefined,dob:pf.dob||undefined,gender:pf.gender||undefined,blood_group:pf.blood_group||undefined,address:pf.address||undefined});
      setSaving(false);
      if(d.patient){setShowPat(false);setPf({name:"",phone:"",email:"",dob:"",gender:"",blood_group:"",address:""});setMsg("Patient registered! ID: "+d.patient.patient_no);}
      else setMsg("Error: "+(d.error||"Unknown"));
    }
    async function deactivate(s){
      if(!confirm("Deactivate "+s.name+"? They will lose access immediately."))return;
      const d=await api("PATCH","/api/staff/"+s.id+"/deactivate",{});
      if(d.message){setStaff(prev=>prev.filter(x=>x.id!==s.id));setMsg(s.name+" deactivated.");}
      else setMsg("Error: "+(d.error||"Unknown"));
    }
    async function unlock(s){
      const d=await api("PATCH","/api/staff/"+s.id+"/unlock",{});
      if(d.message){setStaff(prev=>prev.map(x=>x.id===s.id?{...x,locked_at:null,failed_attempts:0}:x));setMsg(s.name+" unlocked.");}
      else setMsg("Error: "+(d.error||"Unknown"));
    }
    async function resetPwd(s){
      if(!confirm("Reset password for "+s.name+"? A new temporary password will be generated."))return;
      const d=await api("PATCH","/api/staff/"+s.id+"/reset-password",{});
      if(d.tempPassword){setMsg("Password reset for "+s.name);setTempPwdMsg("Temporary password: "+d.tempPassword+" (share securely with user)");}
      else setMsg("Error: "+(d.error||"Unknown"));
    }

    function auditDotClass(action){
      if(action.includes("FAIL")||action.includes("LOCK")||action.includes("DEACTIVAT"))return "danger";
      if(action.includes("LOGIN_SUCCESS")||action.includes("CREATED")||action.includes("UNLOCK"))return "ok";
      if(action.includes("PASSWORD")||action.includes("RESET"))return "warn";
      return "info";
    }

    // Privilege matrix data
    const privileges = [
      {module:"Patient Registration",superAdmin:true,admin:true,doctor:false,technician:false},
      {module:"Book Tests",superAdmin:true,admin:true,doctor:false,technician:false},
      {module:"Sample Tracking",superAdmin:true,admin:true,doctor:"View",technician:"Update"},
      {module:"Enter Results",superAdmin:true,admin:false,doctor:"View",technician:true},
      {module:"Sign Reports",superAdmin:true,admin:false,doctor:true,technician:false},
      {module:"Billing",superAdmin:true,admin:true,doctor:false,technician:false},
      {module:"Test Catalogue",superAdmin:true,admin:true,doctor:"View",technician:"View"},
      {module:"User Management",superAdmin:true,admin:true,doctor:false,technician:false},
      {module:"Audit Trail",superAdmin:true,admin:"View",doctor:false,technician:false},
      {module:"System Settings",superAdmin:true,admin:false,doctor:false,technician:false},
    ];
    function privCell(val){
      if(val===true)return h("span",{style:{color:"var(--ok)",fontWeight:700}},"✓ Full");
      if(val===false)return h("span",{style:{color:"var(--danger)",opacity:.5}},"✗");
      if(typeof val==="string")return h("span",{style:{color:"var(--teal)",fontWeight:500}},val);
    }

    return h("div",{className:"fade-in"},
      // Modals
      showStaff&&h(Modal,{title:"Create Staff User",onClose:()=>setShowStaff(false)},
        h("div",{className:"form-grid"},
          h("div",{className:"form-group"},h("label",null,"Full Name *"),h("input",{value:sf.name,onChange:e=>setSf({...sf,name:e.target.value}),placeholder:"Dr. Anita Sharma"})),
          h("div",{className:"form-group"},h("label",null,"Username *"),h("input",{type:"text",value:sf.username||"",onChange:e=>setSf({...sf,username:e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,"")}),placeholder:"e.g. anita.sharma",autoCapitalize:"none"})),
          h("div",{className:"form-group"},h("label",null,"Email"),h("input",{type:"email",value:sf.email,onChange:e=>setSf({...sf,email:e.target.value}),placeholder:"anita@hospital.com (optional)"})),
          h("div",{className:"form-group"},h("label",null,"Phone"),h("input",{type:"tel",value:sf.phone,onChange:e=>setSf({...sf,phone:e.target.value}),placeholder:"+91 9XXXXXXXXX"})),
          h("div",{className:"form-group"},h("label",null,"Role *"),
            h("select",{value:sf.role,onChange:e=>setSf({...sf,role:e.target.value})},
              ["technician","doctor","admin"].map(r=>h("option",{key:r,value:r},r.charAt(0).toUpperCase()+r.slice(1)))
            )
          ),
          h("div",{className:"form-group"},h("label",null,"Designation *"),h("input",{value:sf.designation,onChange:e=>setSf({...sf,designation:e.target.value}),placeholder:"Senior Pathologist"})),
          h("div",{className:"form-group"},h("label",null,"Department"),h("input",{value:sf.department,onChange:e=>setSf({...sf,department:e.target.value}),placeholder:"Hematology"})),
          h("div",{className:"form-group"},h("label",null,"Qualification"),h("input",{value:sf.qualification,onChange:e=>setSf({...sf,qualification:e.target.value}),placeholder:"MD Pathology"})),
          h("div",{className:"form-group"},h("label",null,"Account Expires (optional)"),h("input",{type:"date",value:sf.account_expires_at,onChange:e=>setSf({...sf,account_expires_at:e.target.value})}))
        ),
        h("div",{style:{background:"var(--p-light)",borderRadius:"var(--r-md)",padding:"10px 14px",marginBottom:12,fontSize:12,color:"var(--p)"}},
          "A temporary password will be auto-generated and shown after creation. User must change it on first login."
        ),
        h("div",{style:{display:"flex",gap:10}},
          h("button",{onClick:createStaff,disabled:saving,className:"btn primary",style:{flex:1}},saving?"Creating...":"Create Staff User"),
          h("button",{onClick:()=>setShowStaff(false),className:"btn",style:{padding:"12px 20px"}},"Cancel")
        )
      ),
      showPat&&h(Modal,{title:"Register New Patient",onClose:()=>setShowPat(false)},
        h("div",{className:"form-grid"},
          h("div",{className:"form-group"},h("label",null,"Full Name *"),h("input",{value:pf.name,onChange:e=>setPf({...pf,name:e.target.value}),placeholder:"Patient full name"})),
          h("div",{className:"form-group"},h("label",null,"Phone *"),h("input",{type:"tel",value:pf.phone,onChange:e=>setPf({...pf,phone:e.target.value}),placeholder:"+91 9XXXXXXXXX"})),
          h("div",{className:"form-group"},h("label",null,"Email"),h("input",{type:"email",value:pf.email,onChange:e=>setPf({...pf,email:e.target.value}),placeholder:"Optional"})),
          h("div",{className:"form-group"},h("label",null,"Date of Birth"),h("input",{type:"date",value:pf.dob,onChange:e=>setPf({...pf,dob:e.target.value})})),
          h("div",{className:"form-group"},h("label",null,"Gender"),h("select",{value:pf.gender,onChange:e=>setPf({...pf,gender:e.target.value})},h("option",{value:""},"Select"),["Male","Female","Other"].map(g=>h("option",{key:g,value:g},g)))),
          h("div",{className:"form-group"},h("label",null,"Blood Group"),h("select",{value:pf.blood_group,onChange:e=>setPf({...pf,blood_group:e.target.value})},h("option",{value:""},"Select"),["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=>h("option",{key:g,value:g},g))))
        ),
        h("div",{className:"form-group"},h("label",null,"Address"),h("textarea",{value:pf.address,onChange:e=>setPf({...pf,address:e.target.value}),rows:2,placeholder:"Full address",style:{resize:"none"}})),
        h("div",{style:{display:"flex",gap:10}},
          h("button",{onClick:createPat,disabled:saving,className:"btn primary",style:{flex:1}},saving?"Registering...":"Register Patient"),
          h("button",{onClick:()=>setShowPat(false),className:"btn",style:{padding:"12px 20px"}},"Cancel")
        )
      ),

      // Header
      h("div",{className:"page-header"},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}},
          h("div",null,h("div",{className:"page-title"},"User Management"),h("div",{className:"page-sub"},"users · roles · security · audit trail")),
          h("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            h("button",{onClick:()=>{setShowPat(true);setMsg("");},className:"btn",style:{fontSize:12}},"+ Register Patient"),
            h("button",{onClick:()=>{setShowStaff(true);setMsg("");},className:"btn primary",style:{width:"auto",padding:"9px 16px",fontSize:12}},"+ Add Staff")
          )
        )
      ),

      // Messages
      msg&&h("div",{className:"alert "+(msg.includes("Error")?"alert-err":"alert-ok")},msg),
      tempPwdMsg&&h("div",{style:{background:"#FFF3CD",border:"1px solid #FFCA2C",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:14,fontSize:13}},
        h("div",{style:{fontWeight:600,marginBottom:4}},"🔑 Temporary Password Generated"),
        h("div",{style:{fontFamily:"var(--mono)",fontSize:14,color:"var(--danger)",fontWeight:700}},tempPwdMsg),
        h("div",{style:{fontSize:11,color:"var(--t2)",marginTop:4}},"Share this password securely with the user. It expires in 24 hours.")
      ),

      // Tabs
      h("div",{className:"tab-bar"},
        ["staff","privilege","audit","settings"].map(t=>
          h("button",{key:t,className:"tab-btn"+(tab===t?" active":""),onClick:()=>setTab(t)},
            {staff:"👥 Staff",privilege:"🔒 Privilege Matrix",audit:"📋 Audit Trail",settings:"⚙️ Security Settings"}[t]
          )
        )
      ),

      // ── STAFF TAB ──
      tab==="staff"&&h("div",null,
        // Stats
        h("div",{className:"stat-grid",style:{marginBottom:16}},
          [{label:"Total Staff",val:staff.length,c:""},
           {label:"Active",val:staff.filter(s=>!s.locked_at).length,c:"teal",cls:"teal"},
           {label:"Locked",val:staff.filter(s=>s.locked_at).length,c:"red",cls:"danger"},
           {label:"Pwd Expiring",val:staff.filter(s=>s.password_expires_at&&new Date(s.password_expires_at)<new Date(Date.now()+14*86400000)).length,c:"gold",cls:"warn"},
          ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
            h("div",{className:"stat-label"},s.label),
            h("div",{className:"stat-val "+(s.cls||"")},s.val)
          ))
        ),
        loadingS&&h(Spinner),
        !loadingS&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
          h("div",{className:"table-wrap"},
            h("table",{className:"glass-table"},
              h("thead",null,h("tr",null,["Staff No","Name","Role","Designation","Last Login","Pwd Expires","Status","Actions"].map(c=>h("th",{key:c},c)))),
              h("tbody",null,staff.map(s=>h("tr",{key:s.id,style:{opacity:s.is_active===false?.5:1}},
                h("td",{style:{fontFamily:"var(--mono)",fontWeight:600,color:"var(--p)",fontSize:11}},s.staff_no),
                h("td",null,
                  h("div",{style:{fontWeight:500}},s.name),
                  h("div",{style:{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}},s.email)
                ),
                h("td",null,h(Badge,{label:s.role,type:s.role==="admin"?"danger":s.role==="doctor"?"purple":"teal"})),
                h("td",{style:{fontSize:12,color:"var(--t2)"}},s.designation||"—"),
                h("td",{style:{fontSize:11,fontFamily:"var(--mono)",color:"var(--t3)"}},
                  s.last_login_at?new Date(s.last_login_at).toLocaleDateString("en-IN"):"Never"
                ),
                h("td",{style:{fontSize:11,fontFamily:"var(--mono)",color:s.password_expires_at&&new Date(s.password_expires_at)<new Date(Date.now()+14*86400000)?"var(--warn)":"var(--t3)"}},
                  s.password_expires_at?new Date(s.password_expires_at).toLocaleDateString("en-IN"):"Never"
                ),
                h("td",null,
                  s.locked_at
                  ?h(Badge,{label:"Locked",type:"danger"})
                  :s.must_change_password
                  ?h(Badge,{label:"Temp Pwd",type:"warn"})
                  :h(Badge,{label:"Active",type:"ok"})
                ),
                h("td",null,
                  h("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
                    s.locked_at&&h("button",{onClick:()=>unlock(s),className:"btn sm",style:{background:"var(--ok)",color:"#fff",border:"none",fontSize:10}},"Unlock"),
                    h("button",{onClick:()=>resetPwd(s),className:"btn sm",style:{fontSize:10}},"Reset Pwd"),
                    h("button",{onClick:()=>deactivate(s),className:"btn danger-sm",style:{fontSize:10}},"Deactivate")
                  )
                )
              )))
            )
          )
        )
      ),

      // ── PRIVILEGE MATRIX TAB ──
      tab==="privilege"&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{style:{padding:"16px 20px 8px",borderBottom:"1px solid var(--b2)"}},
          h("div",{style:{fontSize:13,fontWeight:600,color:"var(--t1)"}},"Role-Based Access Control Matrix"),
          h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}},"defines what each role can do in the system")
        ),
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,
              ["Module","Super Admin","Admin","Doctor","Technician"].map(c=>h("th",{key:c},c))
            )),
            h("tbody",null,privileges.map(p=>h("tr",{key:p.module},
              h("td",{style:{fontWeight:500}},p.module),
              h("td",null,privCell(p.superAdmin)),
              h("td",null,privCell(p.admin)),
              h("td",null,privCell(p.doctor)),
              h("td",null,privCell(p.technician))
            )))
          )
        )
      ),

      // ── AUDIT TRAIL TAB ──
      tab==="audit"&&h("div",null,
        h("div",{className:"card",style:{marginBottom:12}},
          h("div",{style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}},
            h("div",{className:"form-group",style:{marginBottom:0,flex:1}},
              h("label",null,"Category"),
              h("select",{value:auditFilter.category,onChange:e=>setAuditFilter({...auditFilter,category:e.target.value})},
                h("option",{value:""},"All"),
                ["auth","user_management","samples","reports","system"].map(c=>h("option",{key:c,value:c},c))
              )
            ),
            h("div",{className:"form-group",style:{marginBottom:0,flex:1}},
              h("label",null,"From Date"),
              h("input",{type:"date",value:auditFilter.from,onChange:e=>setAuditFilter({...auditFilter,from:e.target.value})})
            ),
            h("div",{className:"form-group",style:{marginBottom:0,flex:1}},
              h("label",null,"To Date"),
              h("input",{type:"date",value:auditFilter.to,onChange:e=>setAuditFilter({...auditFilter,to:e.target.value})})
            ),
            h("button",{onClick:loadAudit,className:"btn primary",style:{width:"auto",padding:"9px 20px"}},"Filter")
          )
        ),
        auditLoading&&h(Spinner),
        !auditLoading&&h("div",{className:"card"},
          h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}},
            h("div",{style:{fontWeight:600,fontSize:13}},auditLogs.length+" entries"),
            h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},"IMMUTABLE · CANNOT BE EDITED OR DELETED")
          ),
          auditLogs.length===0&&h("div",{style:{textAlign:"center",padding:24,color:"var(--t3)"}},"No audit entries found."),
          auditLogs.map(log=>h("div",{key:log.id,className:"audit-entry"},
            h("div",{className:"audit-dot "+auditDotClass(log.action)}),
            h("div",{style:{flex:1}},
              h("div",{style:{fontSize:12,fontWeight:500,color:"var(--t1)"}},log.action.replace(/_/g," ")),
              h("div",{style:{fontSize:11,color:"var(--t2)",marginTop:2}},
                (log.user_name||"System")+" · "+(log.target_name?log.target_name+" · ":"")+(log.notes||"")
              ),
              h("div",{style:{fontSize:10,fontFamily:"var(--mono)",color:"var(--t3)",marginTop:2}},
                new Date(log.created_at).toLocaleString("en-IN")+" · IP: "+(log.ip_address||"—")
              )
            ),
            h("div",null,h(Badge,{label:log.status,type:log.status==="success"?"ok":"danger"}))
          ))
        )
      ),

      // ── SECURITY SETTINGS TAB ──
      tab==="settings"&&h("div",null,
        h("div",{className:"card",style:{marginBottom:12}},
          h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
            h("div",null,
              h("div",{style:{fontWeight:600,fontSize:14}},"🔒 Password Policy"),
              h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},"enforced for all staff logins")
            )
          ),
          h("div",{className:"form-grid"},
            [
              {key:"pwd_min_length",label:"Minimum Password Length",type:"number"},
              {key:"pwd_expiry_days",label:"Password Expiry (days, 0=never)",type:"number"},
              {key:"pwd_history_count",label:"Password History (cannot reuse last N)",type:"number"},
              {key:"max_failed_attempts",label:"Max Failed Attempts Before Lockout",type:"number"},
              {key:"temp_pwd_expiry_hrs",label:"Temporary Password Expiry (hours)",type:"number"},
              {key:"session_timeout",label:"Session Timeout (minutes)",type:"number"},
            ].map(s=>h("div",{key:s.key,className:"form-group"},
              h("label",null,s.label),
              h("input",{type:s.type,value:settings[s.key]||"",onChange:e=>setSettings({...settings,[s.key]:e.target.value})})
            ))
          ),
          h("div",{className:"form-grid"},
            [
              {key:"pwd_require_upper",label:"Require Uppercase Letter"},
              {key:"pwd_require_number",label:"Require Number"},
              {key:"pwd_require_special",label:"Require Special Character"},
              {key:"audit_trail",label:"Audit Trail Active"},
            ].map(s=>h("div",{key:s.key,style:{display:"flex",alignItems:"center",gap:10}},
              h("input",{type:"checkbox",checked:settings[s.key]==="true",onChange:e=>setSettings({...settings,[s.key]:String(e.target.checked)}),style:{width:"auto"}}),
              h("label",{style:{margin:0,textTransform:"none",fontSize:13,color:"var(--t1)"}},s.label)
            ))
          ),
          h("button",{onClick:saveSettings,disabled:savingSettings,className:"btn primary",style:{width:"auto",padding:"10px 24px",marginTop:8}},savingSettings?"Saving...":"Save Security Settings")
        ),
        h("div",{className:"card"},
          h("div",{style:{fontWeight:600,fontSize:14,marginBottom:12}},"🏥 Laboratory Settings"),
          h("div",{className:"form-grid"},
            [
              {key:"lab_name",label:"Laboratory Name"},
              {key:"lab_accreditation",label:"Accreditation"},
            ].map(s=>h("div",{key:s.key,className:"form-group"},
              h("label",null,s.label),
              h("input",{value:settings[s.key]||"",onChange:e=>setSettings({...settings,[s.key]:e.target.value})})
            ))
          ),
          h("button",{onClick:saveSettings,disabled:savingSettings,className:"btn primary",style:{width:"auto",padding:"10px 24px"}},savingSettings?"Saving...":"Save Lab Settings")
        )
      )
    );
  }
  const pages={dashboard:h(Dashboard),samples:h(Samples),patients:h(Patients),billing:h(Billing),tests:h(ManageTests),users:h(UsersManagement)};
  return h(AppShell,{nav,active,setActive,user,onLogout},pages[active]||pages.dashboard);
}
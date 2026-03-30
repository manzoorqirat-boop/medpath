/* MedPath LIS — Technician + Doctor + Session + App Root */

function TechApp({user,onLogout}) {
  const [active,setActive]=useState("dashboard");
  const [samples,setSamples]=useState([]);
  const [allSamples,setAllSamples]=useState([]);
  const [selected,setSelected]=useState(null);
  const [params,setParams]=useState([]);
  const [inputs,setInputs]=useState({});
  const [techNotes,setTechNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [savedMsg,setSavedMsg]=useState("");
  const [viewId,setViewId]=useState(null);
  const nav=[{id:"dashboard",icon:"🏠",label:"Dashboard"},{id:"results",icon:"📝",label:"Results"},{id:"all",icon:"📋",label:"All Samples"}];

  useEffect(()=>{
    api("GET","/api/samples?limit=50").then(d=>{
      if(d.samples){setAllSamples(d.samples);setSamples(d.samples.filter(s=>s.status==="Collected"||s.status==="Processing"));}
    });
  },[]);

  async function updateStatus(id,status) {
    const data=await api("PATCH","/api/samples/"+id+"/status",{status});
    if(data.sample){const up=s=>s.id===id?{...s,status}:s;setSamples(prev=>prev.map(up));setAllSamples(prev=>prev.map(up));}
  }

  function Dashboard() {
    const urgent=samples.filter(s=>s.priority==="Urgent");
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},(function(){const hr=new Date().getHours();const g=hr<12?"Good morning":hr<17?"Good afternoon":hr<21?"Good evening":"Good night";return g+", "+user.name.split(" ")[0]+" 👋";})()),
        h("div",{className:"page-sub"},"technician · processing queue")
      ),
      h("div",{className:"stat-grid"},
        [{label:"Collected",val:samples.filter(s=>s.status==="Collected").length,cls:"warn",c:"gold"},
         {label:"Processing",val:samples.filter(s=>s.status==="Processing").length,cls:"teal",c:"teal"},
         {label:"Urgent",val:urgent.length,cls:"danger",c:"red"},
         {label:"Total Queue",val:samples.length,cls:"",c:""},
        ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
          h("div",{className:"stat-label"},s.label),
          h("div",{className:"stat-val "+(s.cls||"")},s.val)
        ))
      ),
      h("div",{className:"card"},
        h("div",{className:"section-title"},"Sample Queue"),
        samples.length===0&&h("div",{style:{textAlign:"center",padding:24,color:"var(--t3)",fontFamily:"var(--mono)",fontSize:12}},"ALL CLEAR — No samples pending"),
        samples.slice(0,8).map(s=>h("div",{key:s.id,className:"row"},
          h("div",{style:{display:"flex",alignItems:"center",gap:12}},
            h("div",{className:"avatar"},s.patient_name?s.patient_name[0]:"P"),
            h("div",null,
              h("div",{style:{fontWeight:500,fontSize:13}},s.sample_no+" · "+(s.patient_name||"Patient")),
              h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},"created: "+new Date(s.created_at).toLocaleString())
            )
          ),
          h("div",{style:{display:"flex",gap:8,alignItems:"center"}},
            s.priority==="Urgent"&&h(Badge,{label:"URGENT",type:"danger"}),
            h(Badge,{label:s.status,type:statusType(s.status)})
          )
        ))
      )
    );
  }

  function Results() {
    const queue=samples.filter(s=>s.status==="Collected"||s.status==="Processing");
    const submitted=samples.filter(s=>s.status==="Reported"||s.status==="Dispatched");
    const [submittedReports,setSubmittedReports]=useState(null);
    const [editReason,setEditReason]=useState("");
    const [requesting,setRequesting]=useState(false);

    async function loadSample(s) {
      setSelected(s);setParams([]);setTechNotes("");setSavedMsg("Loading...");setSubmittedReports(null);
      updateStatus(s.id,"Processing").catch(function(){});
      try {
        // Check if already submitted
        const sr=await api("GET","/api/reports/sample/"+s.id+"/submitted");
        if(sr.submitted&&sr.reports&&sr.reports.length>0){
          const anyApproved=sr.reports.some(r=>r.edit_approved);
          if(!anyApproved){
            setSubmittedReports(sr.reports);
            setSavedMsg("");
            return;
          }
          setSavedMsg("✏️ Edit approved by admin. You may now modify results.");
        }
        const sd=await api("GET","/api/samples/"+s.id);
        if(!sd.sample){setSavedMsg("Error loading sample.");return;}
        const sampleTests=sd.sample.tests||[];
        if(!sampleTests.length){setSavedMsg("No tests linked to this sample.");return;}
        const withParams=sampleTests.filter(t=>Array.isArray(t.parameters)&&t.parameters.length>0);
        if(!withParams.length){setSavedMsg("No parameters found. Add in Admin > Tests.");return;}
        setParams(withParams);
        setSubmittedReports(null);
      } catch(err){setSavedMsg("Error: "+String(err));}
    }

    async function requestEdit(reportId){
      if(!editReason.trim()){alert("Please enter a reason for modification.");return;}
      setRequesting(true);
      const d=await api("POST","/api/reports/"+reportId+"/request-edit",{reason:editReason});
      setRequesting(false);
      if(d.message){
        setEditReason("");
        const sr=await api("GET","/api/reports/sample/"+selected.id+"/submitted");
        if(sr.reports)setSubmittedReports(sr.reports);
        alert("Edit request sent to admin for approval.");
      } else alert("Error: "+(d.error||"Unknown"));
    }

    async function saveAll(){
      let anyError=false;let lastReport="";
      setSaving(true);setSavedMsg("Saving...");
      const techNotesVal=document.getElementById("tech-notes-input")?document.getElementById("tech-notes-input").value:"";
      for(const test of params){
        const results=test.parameters.map(p=>{
          const inp=document.querySelector('[data-pid="'+p.id+'"]');
          const val=inp?inp.value.trim():"";
          const mn=p.range_male_min;const mx=p.range_male_max;
          const flag=!val?"Pending":mn!=null&&parseFloat(val)<parseFloat(mn)?"Low":mx!=null&&parseFloat(val)>parseFloat(mx)?"High":"Normal";
          return {param_name:p.param_name,value:val,unit:p.unit||"",flag,ref_range:p.range_text||""};
        });
        const filled=results.filter(r=>r.value).length;
        if(!filled)continue;
        const d=await api("POST","/api/reports/sample/"+selected.id+"/test/"+test.id,{results,tech_notes:techNotesVal});
        if(d.report)lastReport=d.report.report_no;
        else anyError=true;
      }
      setSaving(false);
      if(lastReport){
        await updateStatus(selected.id,"Reported").catch(function(){});
        // Remove from queue immediately
        setSamples(prev=>prev.filter(s=>s.id!==selected.id));
        setAllSamples(prev=>prev.map(s=>s.id===selected.id?{...s,status:"Reported"}:s));
        const sr=await api("GET","/api/reports/sample/"+selected.id+"/submitted");
        if(sr.reports){setSubmittedReports(sr.reports);setParams([]);}
        setSavedMsg("✅ Results saved! Report: "+lastReport+" — Submitted for doctor review.");
      } else {
        setSavedMsg(anyError?"❌ Error saving.":"Enter at least one value first.");
      }
    }

    if(viewId)return h(ReportViewer,{reportId:viewId,onClose:()=>setViewId(null),showSendActions:false});

    // ── Sample list ──
    if(!selected)return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},"Results Entry"),
        h("div",{className:"page-sub"},"select sample to enter values")
      ),
      h("div",{style:{display:"flex",justifyContent:"flex-end",marginBottom:10}},
        h("button",{onClick:async()=>{
          const d=await api("GET","/api/samples?limit=50");
          if(d.samples){setAllSamples(d.samples);setSamples(d.samples.filter(s=>s.status==="Collected"||s.status==="Processing"));}
        },className:"btn sm"},"🔄 Refresh")
      ),
      queue.length===0&&submitted.length===0&&h("div",{className:"card",style:{textAlign:"center",padding:40}},
        h("div",{style:{fontSize:44,marginBottom:8}},"✅"),
        h("p",{style:{color:"var(--t2)"}},"No pending samples.")
      ),
      queue.map(s=>h("div",{key:s.id,className:"card"},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
          h("div",{style:{display:"flex",alignItems:"center",gap:12}},
            h("div",{className:"avatar",style:{width:44,height:44,fontSize:16}},s.patient_name?s.patient_name[0]:"P"),
            h("div",null,
              h("div",{style:{fontWeight:600,fontSize:14}},s.patient_name||"Patient"),
              h("div",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--p)"}},s.sample_no),
              h("div",{style:{fontSize:11,color:"var(--t3)"}},(s.test_codes||[]).join(", ")||"")
            )
          ),
          h("div",{style:{display:"flex",gap:8}},
            h(Badge,{label:s.status,type:statusType(s.status)}),
            h("button",{onClick:()=>loadSample(s),className:"btn sm teal",style:{color:"#fff"}},"Enter Results →")
          )
        )
      )),
      submitted.length>0&&h("div",null,
        h("div",{style:{fontSize:10,fontWeight:600,color:"var(--t3)",fontFamily:"var(--mono)",letterSpacing:".08em",textTransform:"uppercase",margin:"16px 0 8px"}},"Submitted — Edit Request Only"),
        submitted.map(s=>h("div",{key:s.id,className:"card",style:{borderLeft:"3px solid var(--ok)"}},
          h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
            h("div",{style:{display:"flex",alignItems:"center",gap:12}},
              h("div",{className:"avatar",style:{width:44,height:44,fontSize:16}},s.patient_name?s.patient_name[0]:"P"),
              h("div",null,
                h("div",{style:{fontWeight:600,fontSize:14}},s.patient_name||"Patient"),
                h("div",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--p)"}},s.sample_no),
                h("div",{style:{fontSize:11,color:"var(--ok)",fontWeight:500}},"✓ Results Submitted")
              )
            ),
            h("div",{style:{display:"flex",gap:8,alignItems:"center"}},
              h(Badge,{label:s.status,type:statusType(s.status)}),
              h("button",{onClick:()=>loadSample(s),className:"btn sm",style:{background:"var(--warn)",color:"#fff",border:"none"}},"✏ Request Edit")
            )
          )
        ))
      )
    );

    // ── Submitted read-only view ──
    if(submittedReports&&submittedReports.length>0&&params.length===0)return h("div",{className:"fade-in"},
      h("div",{style:{marginBottom:14}},
        h("div",{className:"page-title"},selected.patient_name||"Patient"),
        h("div",{className:"page-sub"},selected.sample_no+" · submitted")
      ),
      h("div",{className:"alert alert-ok",style:{marginBottom:16}},"✅ Results submitted. To modify, request admin approval below."),
      submittedReports.map(rpt=>h("div",{key:rpt.id,className:"card",style:{marginBottom:12}},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:10}},
          h("div",null,
            h("div",{style:{fontWeight:600,fontSize:14}},rpt.test_name),
            h("div",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--p)"}},rpt.report_no),
            rpt.is_signed&&h(Badge,{label:"Doctor Signed",type:"ok"})
          ),
          !rpt.is_signed&&(
            rpt.edit_requested
            ?h(Badge,{label:"Edit Requested — Awaiting Admin",type:"warn"})
            :h("div",{style:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}},
              h("input",{value:editReason,onChange:e=>setEditReason(e.target.value),
                placeholder:"Reason for modification...",
                style:{fontSize:12,padding:"6px 10px",border:"1px solid var(--b1)",borderRadius:"var(--r-md)",minWidth:180}}),
              h("button",{onClick:()=>requestEdit(rpt.id),disabled:requesting,className:"btn sm",
                style:{background:"var(--warn)",color:"#fff",border:"none",whiteSpace:"nowrap"}},
                requesting?"Sending...":"Request Edit")
            )
          )
        ),
        (rpt.results||[]).filter(r=>r.value).length>0&&h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Parameter","Result","Unit","Ref Range","Flag"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,(rpt.results||[]).filter(r=>r.value).map((res,i)=>h("tr",{key:i,
              style:{background:res.flag==="High"||res.flag==="Critical"?"rgba(192,57,43,0.04)":res.flag==="Low"?"rgba(198,124,26,0.04)":"transparent"}},
              h("td",{style:{fontWeight:500}},res.param_name),
              h("td",{style:{fontWeight:700,color:res.flag==="High"||res.flag==="Critical"?"var(--danger)":res.flag==="Low"?"var(--warn)":"var(--ok)"}},res.value),
              h("td",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)"}},res.unit||"—"),
              h("td",{style:{fontFamily:"var(--mono)",fontSize:11}},res.ref_range||"—"),
              h("td",null,h(Badge,{label:res.flag||"Normal",type:res.flag==="High"||res.flag==="Critical"?"danger":res.flag==="Low"?"warn":"ok"}))
            )))
          )
        )
      ))
    );

    // ── Entry form ──
    return h("div",{className:"fade-in"},
      h("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}},
        h("button",{onClick:()=>setSelected(null),className:"btn sm"},"← Back"),
        h("div",{style:{flex:1}},
          h("div",{className:"page-title"},selected.patient_name||"Patient"),
          h("div",{className:"page-sub"},selected.sample_no+" · enter results")
        ),
        params.length>0&&h("button",{onClick:saveAll,disabled:saving,className:"btn primary",style:{width:"auto",padding:"9px 20px"}},
          saving?"Saving...":"Save & Submit ✓")
      ),
      savedMsg&&h("div",{className:"alert "+(savedMsg.startsWith("❌")?"alert-err":"alert-ok")},savedMsg),
      params.length===0&&!savedMsg&&h("div",{className:"card",style:{textAlign:"center",padding:30}},h(Spinner)),
      params.length>0&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,
              h("th",null,"Test"),h("th",null,"Parameter"),
              h("th",null,"Ref Range"),h("th",null,"Value"),
              h("th",null,"Unit"),h("th",null,"Flag")
            )),
            h("tbody",null,
              params.map(test=>(test.parameters||[]).map((p,pi)=>h("tr",{key:p.id},
                pi===0&&h("td",{rowSpan:(test.parameters||[]).length,
                  style:{verticalAlign:"top",paddingTop:12,fontWeight:600,fontSize:12,
                    color:"var(--p)",borderRight:"1px solid var(--b2)",minWidth:90}},
                  h("div",null,test.name),
                  h("div",{style:{fontSize:9,color:"var(--t3)",fontFamily:"var(--mono)",fontWeight:400,marginTop:2}},test.category)
                ),
                h("td",{style:{fontWeight:500,fontSize:13}},p.param_name),
                h("td",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},p.range_text||"—"),
                h("td",null,
                  h("input",{"data-pid":p.id,type:"tel",inputMode:"decimal",defaultValue:"",
                    placeholder:"—",style:{textAlign:"center",fontWeight:600,width:"100%",fontSize:15,
                      border:"1px solid var(--b1)",borderRadius:"var(--r-md)",
                      padding:"8px 4px",background:"var(--surface)",minWidth:70}})
                ),
                h("td",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)",whiteSpace:"nowrap"}},p.unit||"—"),
                h("td",{style:{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)"}},"auto")
              )))
            )
          )
        )
      ),
      params.length>0&&h("div",{className:"card",style:{marginTop:0}},
        h("div",{className:"form-group"},
          h("label",null,"Technician Notes"),
          h("textarea",{id:"tech-notes-input",defaultValue:"",rows:2,
            placeholder:"Specimen quality, observations...",style:{resize:"vertical"}})
        ),
        h("button",{onClick:saveAll,disabled:saving,className:"btn primary"},
          saving?"Saving...":"Save & Submit for Review ✓")
      )
    );
  }

  function AllSamples() {
    const [search,setSearch]=useState("");
    const filtered=allSamples.filter(s=>!search||(s.patient_name||"").toLowerCase().includes(search.toLowerCase())||s.sample_no.includes(search));
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},h("div",{className:"page-title"},"All Samples"),h("div",{className:"page-sub"},"complete history")),
      h("div",{className:"search-wrap"},h("span",{className:"search-icon"},"🔍"),h("input",{value:search,onChange:e=>setSearch(e.target.value),placeholder:"Search..."})),
      h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Sample No","Patient","Status","Priority","Date"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,filtered.map(s=>h("tr",{key:s.id},
              h("td",{style:{fontFamily:"var(--mono)",fontWeight:600,color:"var(--p)",fontSize:12}},s.sample_no),
              h("td",{style:{fontWeight:500}},s.patient_name||"—"),
              h("td",null,h(Badge,{label:s.status,type:statusType(s.status)})),
              h("td",null,h(Badge,{label:s.priority||"Normal",type:s.priority==="Urgent"?"danger":"gray"})),
              h("td",{style:{fontSize:11,fontFamily:"var(--mono)",color:"var(--t3)"}},new Date(s.created_at).toLocaleDateString("en-IN"))
            )))
          )
        )
      )
    );
  }

  const pages={dashboard:h(Dashboard),results:h(Results),all:h(AllSamples)};
  return h(AppShell,{nav,active,setActive,user,onLogout},pages[active]||pages.dashboard);
}

function DoctorApp({user,onLogout}) {
  const [active,setActive]=useState("dashboard");
  const [samples,setSamples]=useState([]);
  const nav=[
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"reports",icon:"📊",label:"Reports"},
    {id:"patients",icon:"👥",label:"Patients"},
  ];

  useEffect(()=>{
    api("GET","/api/samples?limit=30").then(d=>{if(d.samples)setSamples(d.samples.filter(s=>s.status==="Reported"));});
  },[]);

  async function signReport(id) {
    const data=await api("PATCH","/api/samples/"+id+"/status",{status:"Dispatched",notes:"Approved by "+user.name});
    if(data.sample)setSamples(prev=>prev.map(s=>s.id===id?{...s,status:"Dispatched"}:s));
  }

  function Dashboard() {
    const [dashReports,setDashReports]=useState([]);
    const [dashLoading,setDashLoading]=useState(true);
    useEffect(()=>{
      api("GET","/api/reports/all").then(d=>{
        if(d.reports)setDashReports(d.reports);
        setDashLoading(false);
      });
    },[]);
    const pending=dashReports.filter(r=>!r.is_signed);
    const verified=dashReports.filter(r=>r.is_signed);
    const todaySigned=verified.filter(r=>r.signed_at&&new Date(r.signed_at).toDateString()===new Date().toDateString());
    const critical=dashReports.filter(r=>(r.results||[]).some(x=>x.flag==="Critical"||x.flag==="High"));
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},
        h("div",{className:"page-title"},(function(){const hr=new Date().getHours();const g=hr<12?"Good morning":hr<17?"Good afternoon":hr<21?"Good evening":"Good night";return g+", Dr. "+user.name.split(" ")[0]+" 👋";})()),
        h("div",{className:"page-sub"},"doctor · "+new Date().toDateString().toLowerCase())
      ),
      h("div",{className:"stat-grid"},
        [{label:"Pending Review",val:pending.length,cls:"warn",c:"gold"},
         {label:"Signed Today",val:todaySigned.length,cls:"ok",c:"teal"},
         {label:"Total Reports",val:dashReports.length,cls:"",c:""},
         {label:"Critical Flags",val:critical.length,cls:"danger",c:"red"},
        ].map(s=>h("div",{key:s.label,className:"stat-card "+(s.c||"")},
          h("div",{className:"stat-label"},s.label),
          h("div",{className:"stat-val "+(s.cls||"")},dashLoading?"—":s.val)
        ))
      ),
      h("div",{className:"card"},
        h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
          h("div",{className:"section-title",style:{marginBottom:0}},"Pending Sign-off"),
          pending.length>0&&h("button",{onClick:()=>setActive("reports"),className:"btn sm",style:{background:"var(--ok)",color:"#fff",border:"none"}},"Go to Reports →")
        ),
        dashLoading&&h(Spinner),
        !dashLoading&&pending.length===0&&h("div",{style:{textAlign:"center",padding:24,color:"var(--t3)",fontFamily:"var(--mono)",fontSize:12}},"✓ ALL CLEAR — No reports pending sign-off"),
        !dashLoading&&pending.slice(0,5).map(r=>h("div",{key:r.id,className:"row"},
          h("div",{style:{display:"flex",alignItems:"center",gap:12}},
            h("div",{className:"avatar"},r.patient_name?r.patient_name[0]:"P"),
            h("div",null,
              h("div",{style:{fontWeight:500,fontSize:13}},r.patient_name||"Patient"),
              h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},r.report_no+" · "+r.test_name)
            )
          ),
          h("div",{style:{display:"flex",gap:8,alignItems:"center"}},
            h(Badge,{label:"Pending",type:"warn"}),
            h("button",{onClick:()=>setActive("reports"),className:"btn sm",style:{background:"var(--ok)",color:"#fff",border:"none"}},"Review →")
          )
        ))
      )
    );
  }


  function SignOff() {
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},h("div",{className:"page-title"},"Reports Sign-off"),h("div",{className:"page-sub"},"review and approve reported samples")),
      samples.length===0&&h("div",{className:"card",style:{textAlign:"center",padding:40}},h("div",{style:{fontSize:44,marginBottom:8}},"✅"),h("p",{style:{color:"var(--t2)"}},"All reports signed off!")),
      samples.length>0&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Sample","Patient","Status","Action"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,samples.map(s=>h("tr",{key:s.id},
              h("td",{style:{fontFamily:"var(--mono)",fontWeight:600,color:"var(--p)",fontSize:12}},s.sample_no),
              h("td",{style:{fontWeight:500}},s.patient_name||"—"),
              h("td",null,h(Badge,{label:s.status,type:statusType(s.status)})),
              h("td",null,h("button",{onClick:()=>signReport(s.id),className:"btn sm",style:{background:"var(--ok)",color:"#fff",border:"none",whiteSpace:"nowrap"}},"Sign & Dispatch"))
            )))
          )
        )
      )
    );
  }

  function DoctorReports() {
    const [reports,setReports]=useState([]);
    const [loading,setLoading]=useState(true);
    const [viewId,setViewId]=useState(null);
    const [signId,setSignId]=useState(null);
    const [note,setNote]=useState("");
    const [saving,setSaving]=useState(false);
    const [msg,setMsg]=useState("");
    useEffect(()=>{api("GET","/api/reports/all").then(d=>{if(d.reports)setReports(d.reports);else setReports([]);setLoading(false);}).catch(()=>setLoading(false));},[]);
    async function signReport(id){
      setSaving(true);setMsg("");
      const d=await api("PATCH","/api/reports/"+id+"/sign",{pathologist_note:note});
      setSaving(false);
      if(d.report){setReports(prev=>prev.map(r=>r.id===id?{...r,is_signed:true,pathologist_name:user.name}:r));setSignId(null);setNote("");setMsg("Report verified!");}
      else setMsg("Error: "+(d.error||"Unknown"));
    }
    async function sendWA(id){const r=await api("GET","/api/reports/"+id+"/whatsapp-link");if(r.link)window.open(r.link,"_blank");else setMsg(r.error||"Failed");}
    async function sendMail(id){const r=await api("POST","/api/reports/"+id+"/send-email",{});setMsg(r.message||r.error||"");}
    if(viewId)return h(ReportViewer,{reportId:viewId,onClose:()=>setViewId(null),showSendActions:true});
    return h("div",{className:"fade-in"},
      signId&&h(Modal,{title:"Sign & Verify Report",onClose:()=>setSignId(null)},
        h("div",{style:{background:"var(--p-light)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:14}},
          h("div",{style:{fontSize:11,fontWeight:600,color:"var(--p)",fontFamily:"var(--mono)",marginBottom:4}},"SIGNING AS"),
          h("div",{style:{fontSize:14,fontWeight:600}},user.name),
          h("div",{style:{fontSize:12,color:"var(--t2)"}},user.designation||"Pathologist"),
          h("div",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},new Date().toLocaleDateString("en-IN")+" · "+new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}))
        ),
        h("div",{className:"form-group"},
          h("label",null,"Pathologist Remarks (optional)"),
          h("textarea",{value:note,onChange:e=>setNote(e.target.value),rows:3,placeholder:"All values within normal limits...",style:{resize:"vertical"}})
        ),
        h("div",{style:{display:"flex",gap:10,marginTop:8}},
          h("button",{onClick:()=>signReport(signId),disabled:saving,className:"btn primary",style:{flex:1}},saving?"Signing...":"Sign & Verify Report ✓"),
          h("button",{onClick:()=>setSignId(null),className:"btn",style:{padding:"12px 20px"}},"Cancel")
        )
      ),
      h("div",{className:"page-header"},h("div",{className:"page-title"},"Reports Management"),h("div",{className:"page-sub"},"verify, dispatch and share reports")),
      msg&&h("div",{className:"alert "+(msg.includes("Error")||msg.includes("failed")?"alert-err":"alert-ok")},msg),
      loading&&h(Spinner),
      !loading&&reports.length===0&&h("div",{className:"card",style:{textAlign:"center",padding:40}},h("div",{style:{fontSize:44,marginBottom:8}},"📊"),h("p",{style:{color:"var(--t3)"}},"No reports yet.")),
      reports.length>0&&h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Report No","Patient","Test","Date","Status","Actions"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,reports.map(r=>h("tr",{key:r.id},
              h("td",{style:{fontFamily:"var(--mono)",fontWeight:700,color:"var(--p)",fontSize:12}},r.report_no||"—"),
              h("td",null,h("div",{style:{fontWeight:500,fontSize:13}},r.patient_name),h("div",{style:{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}},r.patient_no)),
              h("td",{style:{fontSize:12,color:"var(--t2)"}},r.test_name),
              h("td",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}},new Date(r.created_at).toLocaleDateString("en-IN")),
              h("td",null,r.is_signed?h(Badge,{label:"Verified",type:"ok"}):h(Badge,{label:"Pending",type:"warn"})),
              h("td",null,h("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
                h("button",{onClick:()=>setViewId(r.id),className:"btn sm",style:{background:"var(--p)",color:"#fff",border:"none",fontSize:11}},"View"),
                !r.is_signed&&h("button",{onClick:()=>{setSignId(r.id);setNote("");},className:"btn sm",style:{background:"var(--ok)",color:"#fff",border:"none",fontSize:11}},"Sign"),
                h("button",{onClick:()=>window.open(API+"/api/reports/"+r.id+"/pdf","_blank"),className:"btn sm teal",style:{color:"#fff",fontSize:11}},"PDF"),
                h("button",{onClick:()=>sendWA(r.id),className:"btn sm",style:{background:"#25D366",color:"#fff",border:"none",fontSize:11}},"WhatsApp"),
                h("button",{onClick:()=>sendMail(r.id),className:"btn sm",style:{background:"#1A73E8",color:"#fff",border:"none",fontSize:11}},"Email")
              ))
            )))
          )
        )
      )
    );
  }

  function DoctorPatients() {
    const [patients,setPatients]=useState([]);
    const [loading,setLoading]=useState(true);
    const [search,setSearch]=useState("");
    const [selected,setSelected]=useState(null);
    useEffect(()=>{api("GET","/api/patients?limit=50").then(d=>{if(d.patients)setPatients(d.patients);setLoading(false);});},[]);
    const filtered=patients.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.patient_no.includes(search)||(p.phone||"").includes(search));
    if(selected)return h("div",{className:"fade-in"},
      h("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:18}},
        h("button",{onClick:()=>setSelected(null),className:"btn sm"},"← Back"),
        h("div",null,h("div",{className:"page-title"},selected.name),h("div",{className:"page-sub"},"patient · "+selected.patient_no))
      ),
      h("div",{className:"card"},
        h("div",{className:"section-title"},"Patient Information"),
        [["Patient No",selected.patient_no],["Phone",selected.phone||"—"],["Email",selected.email||"—"],["DOB",selected.date_of_birth?new Date(selected.date_of_birth).toLocaleDateString("en-IN"):"—"],["Gender",selected.gender||"—"],["Blood Group",selected.blood_group||"—"]].map(([k,v])=>
          h("div",{key:k,style:{padding:"8px 0",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between"}},
            h("span",{style:{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",textTransform:"uppercase"}},k),
            h("span",{style:{fontSize:13,fontWeight:500}},v)
          )
        )
      )
    );
    return h("div",{className:"fade-in"},
      h("div",{className:"page-header"},h("div",{className:"page-title"},"Patient Records"),h("div",{className:"page-sub"},patients.length+" patients")),
      h("div",{className:"search-wrap"},h("span",{className:"search-icon"},"🔍"),h("input",{value:search,onChange:e=>setSearch(e.target.value),placeholder:"Search by name, phone or patient no..."})),
      loading&&h(Spinner),
      h("div",{className:"card",style:{padding:0,overflow:"visible"}},
        h("div",{className:"table-wrap"},
          h("table",{className:"glass-table"},
            h("thead",null,h("tr",null,["Patient No","Name","Gender","Blood","Phone","Action"].map(c=>h("th",{key:c},c)))),
            h("tbody",null,filtered.map(p=>h("tr",{key:p.id},
              h("td",{style:{fontFamily:"var(--mono)",color:"var(--p)",fontWeight:600,fontSize:12}},p.patient_no),
              h("td",null,h("div",{style:{display:"flex",alignItems:"center",gap:8}},h("div",{className:"avatar",style:{width:28,height:28,fontSize:11}},p.name?p.name[0]:"P"),h("span",{style:{fontWeight:500}},p.name))),
              h("td",{style:{fontSize:12,color:"var(--t2)"}},p.gender||"—"),
              h("td",null,p.blood_group&&h(Badge,{label:p.blood_group,type:"danger"})),
              h("td",{style:{fontFamily:"var(--mono)",fontSize:12,color:"var(--t2)"}},p.phone||"—"),
              h("td",null,h("button",{onClick:()=>setSelected(p),className:"btn sm"},"View"))
            )))
          )
        )
      )
    );
  }

  const pages={dashboard:h(Dashboard),reports:h(DoctorReports),patients:h(DoctorPatients)};
  return h(AppShell,{nav,active,setActive,user,onLogout},pages[active]||pages.dashboard);
}


/* ══════════════════════════════════
   SESSION TIMEOUT MANAGER
══════════════════════════════════ */
function SessionManager({onLogout}) {
  const TIMEOUT_MINS = 30;
  const WARN_MINS    = 5;
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const warnRef  = useRef(null);

  function resetTimer() {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    setCountdown(null);
    const warnMs    = (TIMEOUT_MINS - WARN_MINS) * 60 * 1000;
    const timeoutMs = TIMEOUT_MINS * 60 * 1000;
    warnRef.current = setTimeout(()=>{
      let secs = WARN_MINS * 60;
      setCountdown(secs);
      const interval = setInterval(()=>{
        secs--;
        setCountdown(secs);
        if(secs<=0){clearInterval(interval);onLogout();}
      },1000);
      timerRef.current = interval;
    }, warnMs);
  }

  useEffect(()=>{
    const events=["mousedown","mousemove","keypress","scroll","touchstart","click"];
    events.forEach(e=>document.addEventListener(e,resetTimer,true));
    resetTimer();
    return()=>{
      events.forEach(e=>document.removeEventListener(e,resetTimer,true));
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
    };
  },[]);

  if(countdown===null) return null;
  const mins = Math.floor(countdown/60);
  const secs = countdown%60;
  return h("div",{className:"session-warning"},
    h("div",{className:"session-warning-box"},
      h("h3",null,"⚠ Session Expiring"),
      h("p",null,"Your session will expire due to inactivity. Click anywhere or press Stay Logged In to continue."),
      h("div",{className:"session-countdown"},`${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`),
      h("button",{onClick:resetTimer,className:"btn primary",style:{marginBottom:10}},"Stay Logged In"),
      h("button",{onClick:onLogout,className:"btn",style:{width:"100%"}},"Log Out Now")
    )
  );
}

/* ══════════════════════════════════
   CHANGE PASSWORD MODAL
══════════════════════════════════ */
function ChangePasswordModal({userId, onSuccess, onCancel, reason}) {
  const [cur,setCur]=useState("");
  const [pwd,setPwd]=useState("");
  const [conf,setConf]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [reqs,setReqs]=useState({len:false,upper:false,num:false,spc:false,match:false});

  function checkReqs(p,c){
    setReqs({
      len:  p.length>=8,
      upper:/[A-Z]/.test(p),
      num:  /[0-9]/.test(p),
      spc:  /[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?]/.test(p),
      match:p===c&&p.length>0
    });
  }

  async function submit(){
    if(!cur||!pwd||!conf){setErr("All fields required.");return;}
    if(pwd!==conf){setErr("Passwords do not match.");return;}
    if(!Object.values(reqs).every(Boolean)){setErr("Password does not meet requirements.");return;}
    setLoading(true);setErr("");
    const d=await api("POST","/api/auth/change-password",{userId,currentPassword:cur,newPassword:pwd});
    setLoading(false);
    if(d.message){onSuccess();}
    else setErr(d.error||"Failed to change password");
  }

  const Req=({ok,label})=>h("div",{className:"pwd-req "+(ok?"ok":"fail")},(ok?"✓ ":"✗ ")+label);

  return h("div",{className:"modal-bg"},
    h("div",{className:"modal"},
      h("div",{className:"modal-title"},"🔐 Change Password"),
      reason==="expired"&&h("div",{className:"alert alert-err",style:{marginBottom:14}},"Your password has expired. Please set a new password."),
      !reason&&h("div",{className:"alert alert-ok",style:{marginBottom:14}},"First login detected. Please set your permanent password."),
      err&&h("div",{className:"alert alert-err"},err),
      h("div",{className:"form-group"},
        h("label",null,"Current / Temporary Password"),
        h("input",{type:"password",value:cur,onChange:e=>setCur(e.target.value),placeholder:"Enter current password"})
      ),
      h("div",{className:"form-group"},
        h("label",null,"New Password"),
        h("input",{type:"password",value:pwd,onChange:e=>{setPwd(e.target.value);checkReqs(e.target.value,conf);},placeholder:"Enter new password"})
      ),
      h("div",{className:"form-group"},
        h("label",null,"Confirm New Password"),
        h("input",{type:"password",value:conf,onChange:e=>{setConf(e.target.value);checkReqs(pwd,e.target.value);},placeholder:"Confirm new password"})
      ),
      h("div",{style:{background:"var(--surface2)",borderRadius:"var(--r-md)",padding:"10px 14px",marginBottom:14}},
        h("div",{style:{fontSize:10,fontWeight:600,color:"var(--t3)",fontFamily:"var(--mono)",marginBottom:6}},"PASSWORD REQUIREMENTS"),
        h(Req,{ok:reqs.len,  label:"At least 8 characters"}),
        h(Req,{ok:reqs.upper,label:"At least one uppercase letter"}),
        h(Req,{ok:reqs.num,  label:"At least one number"}),
        h(Req,{ok:reqs.spc,  label:"At least one special character (!@#$%)"}),
        h(Req,{ok:reqs.match,label:"Passwords match"})
      ),
      h("div",{style:{display:"flex",gap:10}},
        h("button",{onClick:submit,disabled:loading,className:"btn primary",style:{flex:1}},loading?"Changing...":"Change Password"),
        onCancel&&h("button",{onClick:onCancel,className:"btn",style:{padding:"12px 20px"}},"Cancel")
      )
    )
  );
}

function App() {
  const [role,setRole]=useState(()=>{return sessionStorage.getItem("mp_role")||null;});
  const [user,setUser]=useState(()=>{try{const u=sessionStorage.getItem("mp_user");return u?JSON.parse(u):null;}catch(e){return null;}});
  const [changePwd,setChangePwd]=useState(null); // {userId, reason}

  function handleLogin(u,back){
    if(back){setRole(null);setUser(null);TOKEN=null;sessionStorage.clear();}
    else{
      const r=u.role==="patient"?"Patient":u.role.charAt(0).toUpperCase()+u.role.slice(1);
      setUser(u);setRole(r);
      sessionStorage.setItem("mp_user",JSON.stringify(u));
      sessionStorage.setItem("mp_role",r);
      if(u.mustChangePassword){setChangePwd({userId:u.id,reason:u.reason});}
    }
  }
  function handleLogout(){setUser(null);setRole(null);TOKEN=null;sessionStorage.clear();setChangePwd(null);}

  if(!role) return h(RoleSelect,{onSelect:setRole});
  if(!user) return h(Login,{role,onLogin:handleLogin});

  // Force password change
  if(changePwd) return h(ChangePasswordModal,{
    userId:changePwd.userId,
    reason:changePwd.reason,
    onSuccess:()=>setChangePwd(null),
    onCancel:null // cannot cancel forced change
  });

  const AppComponent =
    role==="Patient"    ? h(PatientApp,{user,onLogout:handleLogout}) :
    role==="Admin"      ? h(AdminApp,{user,onLogout:handleLogout}) :
    role==="Technician" ? h(TechApp,{user,onLogout:handleLogout}) :
    role==="Doctor"     ? h(DoctorApp,{user,onLogout:handleLogout}) : null;

  return h("div",null,
    AppComponent,
    role!=="Patient"&&h(SessionManager,{onLogout:handleLogout})
  );
}

const root=ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App,null));
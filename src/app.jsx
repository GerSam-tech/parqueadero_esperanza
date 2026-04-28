// Parqueadero La Esperanza - Interactive Demo
import { useState, useEffect, useRef } from "react";
import Tesseract from "tesseract.js";
import jsPDF from "jspdf";
const DB = {
  vehiculos: [
    { id:1, placa:"ABC123", propietario:"Carlos Rodríguez", residente:"María Rodríguez", apto:"301", torre:"A", tipo:"Carro", correo:"carlos@demo.com", whatsapp:"573001234567", mensualidad_atrasada:false, meses_atrasados:0, conflicto_convivencia:false, observaciones:"", activo:true },
    { id:2, placa:"XYZ789", propietario:"Luis Gómez", residente:"Luis Gómez", apto:"502", torre:"B", tipo:"Moto", correo:"luis@demo.com", whatsapp:"", mensualidad_atrasada:true, meses_atrasados:2, conflicto_convivencia:false, observaciones:"2 meses sin pagar mensualidad", activo:true },
    { id:3, placa:"DEF456", propietario:"Ana Torres", residente:"Ana Torres", apto:"102", torre:"A", tipo:"Camioneta", correo:"ana@demo.com", whatsapp:"573009876543", mensualidad_atrasada:false, meses_atrasados:0, conflicto_convivencia:true, observaciones:"Restricción por comité de convivencia — Acta 12/2024", activo:true },
    { id:4, placa:"GHI321", propietario:"Pedro Martínez", residente:"Pedro Martínez", apto:"405", torre:"C", tipo:"Carro", correo:"pedro@demo.com", whatsapp:"", mensualidad_atrasada:false, meses_atrasados:0, conflicto_convivencia:false, observaciones:"", activo:true },
    { id:5, placa:"JKL654", propietario:"Sara López", residente:"Sara López", apto:"201", torre:"B", tipo:"Bicicleta", correo:"", whatsapp:"573005554433", mensualidad_atrasada:true, meses_atrasados:4, conflicto_convivencia:false, observaciones:"Cuatro meses en mora — En proceso de cobro", activo:true },
  ],
  ingresos: [
    { id:1, placa:"ABC123", tipo:"ENTRADA", fecha_hora:"17/04/2026 07:42:11", permitido:true, motivo_negacion:"", propietario:"Carlos Rodríguez", apto:"T A-301" },
    { id:2, placa:"XYZ789", tipo:"ENTRADA", fecha_hora:"17/04/2026 08:15:33", permitido:false, motivo_negacion:"Mensualidades atrasadas: 2 mes(es)", propietario:"Luis Gómez", apto:"T B-502" },
    { id:3, placa:"GHI321", tipo:"ENTRADA", fecha_hora:"17/04/2026 09:01:07", permitido:true, motivo_negacion:"", propietario:"Pedro Martínez", apto:"T C-405" },
    { id:4, placa:"ABC123", tipo:"SALIDA",  fecha_hora:"17/04/2026 12:30:00", permitido:true, motivo_negacion:"", propietario:"Carlos Rodríguez", apto:"T A-301" },
  ],
  celdas: Array.from({length:24},(_,i)=>({ id:i+1, codigo:`C-${String(i+1).padStart(3,'0')}`, torre:String.fromCharCode(65+Math.floor(i/8)), apto:`${(i%8+1)*100+Math.floor(i/8)*100+1}`, ocupada:[2,5,9,14,17].includes(i+1), vehiculo_id:null })),
};

const PICO = { 0:[1,2],1:[3,4],2:[5,6],3:[7,8],4:[9,0],5:[],6:[] };
const DIAS_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function useTime() {
  const [now, setNow] = useState(new Date());
  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  return now;
}

function Toast({toasts,remove}){
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:"#fff",borderRadius:12,padding:"13px 18px",boxShadow:"0 8px 32px rgba(6,80,168,.18)",
          display:"flex",alignItems:"center",gap:12,minWidth:260,maxWidth:340,
          borderLeft:`4px solid ${t.type==="success"?"#15a86b":t.type==="error"?"#e0271a":t.type==="warning"?"#f59e0b":"#0650a8"}`,
          animation:"slideIn .3s ease",pointerEvents:"all",fontSize:13,fontWeight:500}}>
          <span style={{fontSize:18}}>{t.type==="success"?"✅":t.type==="error"?"❌":t.type==="warning"?"⚠️":"ℹ️"}</span>
          <span style={{flex:1}}>{t.msg}</span>
        </div>
      ))}
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}

export default function App() {
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const now = useTime();
  const [section, setSection] = useState("acceso");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [notiOpen, setNotiOpen] = useState(false);
  const [vehiculos, setVehiculos] = useState(DB.vehiculos);
  const [ingresos, setIngresos] = useState(DB.ingresos);
  const [celdas, setCeldas] = useState(DB.celdas);
  const [notificaciones, setNotificaciones] = useState([
    {id:1,tipo:"PICO_PLACA",mensaje:"🚦 Pico y Placa hoy — Dígitos 3,4 — Placa XYZ789 afectada",leida:false,fecha:"17/04/2026 05:30"},
    {id:2,tipo:"DENEGADO",mensaje:"❌ Acceso denegado: XYZ789 — Mora 2 meses",leida:false,fecha:"17/04/2026 08:15"},
    {id:3,tipo:"INGRESO",mensaje:"✅ ENTRADA: ABC123 — Carlos Rodríguez — 07:42",leida:true,fecha:"17/04/2026 07:42"},
  ]);

  // Acceso state
  const [inputPlaca, setInputPlaca] = useState("");
  const [tipoMov, setTipoMov] = useState("ENTRADA");
  const [fichaV, setFichaV] = useState(null);
  const [accessStatus, setAccessStatus] = useState({tipo:"pending",titulo:"Ingrese o capture una placa",motivo:""});
  const [lastIngreso, setLastIngreso] = useState(null);
  const [ocrSimulando, setOcrSimulando] = useState(false);

  // Modal vehiculo
  const [modalV, setModalV] = useState(false);
  const [editV, setEditV] = useState(null);
  const [formV, setFormV] = useState({placa:"",propietario:"",residente:"",torre:"",apto:"",tipo:"Carro",correo:"",whatsapp:"",mensualidad_atrasada:false,meses_atrasados:0,conflicto_convivencia:false,observaciones:""});

  // Pico
  const [picoInput, setPicoInput] = useState("");
  const [picoRes, setPicoRes] = useState(null);

  // Archivos
  const [archivosPlaca, setArchivosPlaca] = useState("");
  const [archivosRes, setArchivosRes] = useState(null);
  const [archivosLoading, setArchivosLoading] = useState(false);

  // Buscar vehiculo
  const [buscarQ, setBuscarQ] = useState("");

  const toast = (msg, type="info") => {
    const id = Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);
  };

  const noLeidas = notificaciones.filter(n=>!n.leida).length;

  // Buscar placa
  const buscarPlaca = (p) => {
    const v = vehiculos.find(x=>x.placa===p.toUpperCase());
    if(v){ setFichaV(v); verificarAcceso(v); }
    else { setFichaV(null); setAccessStatus({tipo:"pending",titulo:`Placa ${p} no registrada`,motivo:"¿Desea registrarla?"}); }
  };

  const verificarAcceso = (v) => {
  // 1️⃣ Vehículo inhabilitado
  if (!v.activo) {
    setAccessStatus({
      tipo: "denied",
      titulo: "ACCESO DENEGADO",
      motivo: "Vehículo inhabilitado",
    });
    return false;
  }

  // 2️⃣ Mensualidad atrasada → ENVÍA WHATSAPP ✅
  if (v.mensualidad_atrasada) {
    const motivo = `Mensualidades atrasadas: ${v.meses_atrasados} mes(es)`;

    setAccessStatus({
      tipo: "denied",
      titulo: "ACCESO DENEGADO",
      motivo,
    });

    enviarWhatsApp(v); // 📲 AQUÍ SE DISPARA WHATSAPP

    return false;
  }

  // 3️⃣ Conflicto de convivencia
  if (v.conflicto_convivencia) {
    setAccessStatus({
      tipo: "denied",
      titulo: "ACCESO DENEGADO",
      motivo: "Restricción por conflicto de convivencia",
    });
    return false;
  }

  // 4️⃣ Pico y placa
  const hoy = now.getDay();
  const digitosRestringidos = PICO[hoy] || [];
  const hora = now.getHours();

  const enPico =
  digitosRestringidos.includes(parseInt(v.placa.slice(-1))) &&
    ((hora >= 6 && hora < 9) || (hora >= 15 && hora < 19));

  if (enPico) {
    setAccessStatus({
      tipo: "denied",
      titulo: "ACCESO DENEGADO",
      motivo: `Pico y placa activo — dígito ${v.placa.slice(-1)}`,
    });
    return false;
  }

  // 5️⃣ Acceso permitido
  setAccessStatus({
    tipo: "allowed",
    titulo: "ACCESO PERMITIDO",
    motivo: "",
  });

  return true;
};


  


const enviarWhatsApp = async (vehiculo) => {
  if (!vehiculo.whatsapp) {
    toast("⚠ No hay número de WhatsApp registrado", "warning");
    return;
  }

  if (!vehiculo.observaciones?.trim()) {
    toast("⚠ No hay observaciones para enviar", "warning");
    return;
  }

  try {
    await fetch("http://localhost:3001/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: vehiculo.whatsapp,
        mensaje: vehiculo.observaciones, // ✅ AQUÍ
      }),
    });

    toast("📩 Mensaje enviado por WhatsApp", "success");
  } catch (err) {
    console.error(err);
    toast("❌ Error enviando WhatsApp", "error");
  }
};

const imprimirTiquete = () => {
  const contenido = `
    <html>
      <head>
        <title>Tiquete Parqueadero</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            width: 280px;
            margin: auto;
          }
          h2 {
            text-align: center;
          }
          .line {
            border-bottom: 1px dashed #000;
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <h2>Parqueadero La Esperanza</h2>
        <div class="line"></div>
        <p><b>Placa:</b> ${inputPlaca}</p>
        <p><b>Tipo:</b> ${tipoMov}</p>
        <p><b>Fecha:</b> ${new Date().toLocaleString("es-CO")}</p>
        <p><b>Estado:</b> ${accessStatus.titulo}</p>
        <div class="line"></div>
        <p style="text-align:center">Gracias por su visita</p>
      </body>
    </html>
  `;

  const ventana = window.open("", "_blank");
  ventana.document.write(contenido);
  ventana.document.close();
  ventana.print();
};

const generarPDF = () => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 150], // tamaño tipo tiquete
  });

  doc.setFontSize(12);
  doc.text("PARQUEADERO LA ESPERANZA", 40, 10, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Placa: ${inputPlaca}`, 10, 25);
  doc.text(`Movimiento: ${tipoMov}`, 10, 32);
  doc.text(
    `Fecha: ${new Date().toLocaleString("es-CO")}`,
    10,
    39
  );
  doc.text(`Estado: ${accessStatus.titulo}`, 10, 46);

  if (accessStatus.motivo) {
    doc.text(`Motivo: ${accessStatus.motivo}`, 10, 53);
  }

  doc.text("Gracias por su visita", 40, 75, { align: "center" });

  doc.save(`tiquete_${inputPlaca}.pdf`);
};

  
const realizarOCR = async () => {
  setOcrSimulando(true);

  const image = capturarFrame();
  if (!image) {
    toast("❌ No se pudo capturar imagen", "error");
    setOcrSimulando(false);
    return;
  }

  toast("🔎 Analizando imagen...", "info");

  try {
    const { data } = await Tesseract.recognize(
      image,
      "eng",
      {
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      }
    );

    
      const textoOCR = data.text
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""); // limpia ruido

      const posibles = textoOCR.match(
        /[A-Z]{3}[0-9]{3}|[A-Z]{3}[0-9]{2}[A-Z]/g
      );

      if (posibles && posibles.length) {
        const placa = posibles[0];
        setInputPlaca(placa);
        buscarPlaca(placa);
        toast(`✅ Placa detectada: ${placa}`, "success");
      } else {
        toast("⚠ No se detectó una placa válida", "warning");
      }



  } catch (err) {
    console.error("OCR ERROR:", err);
    toast("❌ Error procesando OCR", "error");
  } finally {
    setOcrSimulando(false);
  }
};

const normalizarPlaca = raw => {
  return raw
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .replace(/8/g, "B");
};



  const registrarIngreso = () => {
    const placa = inputPlaca.toUpperCase().trim();
    if(!placa){ toast("Ingrese o capture una placa","warning"); return; }
    const v = vehiculos.find(x=>x.placa===placa);
    const permitido = accessStatus.tipo==="allowed";
    const motivo = accessStatus.tipo==="denied" ? accessStatus.motivo : "";
    const nuevo = { id:ingresos.length+1, placa, tipo:tipoMov,
      fecha_hora: now.toLocaleDateString("es-CO")+" "+now.toLocaleTimeString("es-CO"),
      permitido, motivo_negacion:motivo,
      propietario: v?.propietario||"Sin registro", apto: v?`T ${v.torre}-${v.apto}`:"-" };
    setIngresos(p=>[nuevo,...p]);
    setLastIngreso(nuevo.id);
    const noti = { id:Date.now(), tipo:permitido?"INGRESO":"DENEGADO",
      mensaje:`${permitido?"✅":"❌"} ${tipoMov}: ${placa} — ${now.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}`,
      leida:false, fecha:now.toLocaleDateString("es-CO")+" "+now.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}) };
    setNotificaciones(p=>[noti,...p]);
    if(permitido) toast(`✅ ${tipoMov} registrada: ${placa}`,"success");
    else toast(`❌ Acceso DENEGADO — ${motivo}`,"error");
  };

  const guardarVehiculo = () => {
    if(!formV.placa){ toast("La placa es obligatoria","warning"); return; }
    if(editV){
      setVehiculos(p=>p.map(v=>v.id===editV?{...v,...formV}:v));
      toast("Vehículo actualizado","success");
    } else {
      if(vehiculos.find(v=>v.placa===formV.placa.toUpperCase())){ toast("Placa ya registrada","error"); return; }
      setVehiculos(p=>[...p,{...formV,placa:formV.placa.toUpperCase(),id:p.length+1,activo:true}]);
      toast("Vehículo registrado","success");
    }
    setModalV(false); setEditV(null);
  };

  const abrirModalEditar = (v) => {
    setEditV(v.id); setFormV({...v}); setModalV(true);
  };
  const abrirModalNuevo = () => {
    setEditV(null);
    setFormV({placa:inputPlaca||"",propietario:"",residente:"",torre:"",apto:"",tipo:"Carro",correo:"",whatsapp:"",mensualidad_atrasada:false,meses_atrasados:0,conflicto_convivencia:false,observaciones:""});
    setModalV(true);
  };
  const eliminarV = (id,placa) => { if(!confirm(`¿Eliminar ${placa}?`)) return; setVehiculos(p=>p.filter(v=>v.id!==id)); toast("Eliminado","success"); };

  const verificarPico = () => {
    const p = picoInput.toUpperCase().trim(); if(!p) return;
    const d = now.getDay(); const digitos = PICO[d]||[];
    const ultimo = parseInt(p.slice(-1));
    setPicoRes({placa:p, afectada:digitos.includes(ultimo), digitos, dia:DIAS_FULL[d]});
  };

  const buscarArchivos = () => {
    if(!archivosPlaca){ toast("Ingrese una placa","warning"); return; }
    setArchivosLoading(true); setArchivosRes(null);
    setTimeout(()=>{
      const encontrados = vehiculos.find(v=>v.placa===archivosPlaca.toUpperCase());
      const fakeFiles = encontrados ? [
        `C:\\Users\\Admin\\Documents\\Residentes_2024.xlsx`,
        `C:\\Users\\Admin\\Desktop\\Ingresos_Abril.csv`,
        `/home/usuario/parqueadero/registros_${archivosPlaca}.txt`,
      ] : [];
      setArchivosRes(fakeFiles); setArchivosLoading(false);
      if(fakeFiles.length) toast(`Encontrado en ${fakeFiles.length} archivo(s)`,"success");
      else toast("No se encontró en archivos","info");
    },2000);
  };

  const filtradosV = vehiculos.filter(v=>(v.placa+v.propietario+v.residente+v.apto+v.torre).toLowerCase().includes(buscarQ.toLowerCase()));
  const stats = { total:vehiculos.length, hoy:ingresos.filter(i=>i.permitido&&i.tipo==="ENTRADA").length, enParq:ingresos.filter(i=>i.permitido&&i.tipo==="ENTRADA").length - ingresos.filter(i=>i.tipo==="SALIDA").length, denegados:ingresos.filter(i=>!i.permitido).length };

  const navItems = [
    {id:"acceso",icon:"🚗",label:"Control de Acceso"},
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"vehiculos",icon:"🚙",label:"Vehículos"},
    {id:"ingresos",icon:"📋",label:"Historial"},
    {id:"celdas",icon:"🅿️",label:"Celdas"},
    {id:"pico",icon:"🚦",label:"Pico y Placa"},
    {id:"archivos",icon:"📁",label:"Búsqueda Archivos"},
  ];

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const s = {
    root:{fontFamily:"'Exo 2', 'Segoe UI', sans-serif",minHeight:"100vh",background:"#f4f7fc",color:"#0d1b2e",display:"flex"},
    sidebar:{width:250,minHeight:"100vh",background:"linear-gradient(175deg,#0650a8 0%,#023a80 100%)",display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"4px 0 32px rgba(6,80,168,.25)"},
    logo:{padding:"24px 20px 18px",borderBottom:"1px solid rgba(255,255,255,.1)"},
    logoIco:{width:48,height:48,background:"rgba(255,255,255,.15)",borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:8},
    logoH:{color:"#fff",fontSize:14,fontWeight:800,lineHeight:1.2,margin:0},
    logoP:{color:"rgba(255,255,255,.5)",fontSize:10,marginTop:3},
    nav:{flex:1,overflowY:"auto",padding:"14px 10px"},
    navSec:{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:1.5,padding:"10px 12px 5px"},
    navBtn:(active)=>({display:"flex",alignItems:"center",gap:10,padding:"10px 13px",borderRadius:9,color:active?"#fff":"rgba(255,255,255,.65)",cursor:"pointer",marginBottom:2,transition:"all .2s",background:active?"rgba(255,255,255,.18)":"none",border:"none",width:"100%",textAlign:"left",fontSize:13,fontWeight:active?700:500}),
    foot:{padding:14,borderTop:"1px solid rgba(255,255,255,.1)"},
    clock:{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"11px 13px"},
    clockTime:{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:600,color:"#fff"},
    clockDate:{fontSize:10,color:"rgba(255,255,255,.5)",marginTop:3},
    main:{flex:1,display:"flex",flexDirection:"column",minWidth:0},
    topbar:{background:"#fff",height:62,display:"flex",alignItems:"center",padding:"0 24px",gap:14,boxShadow:"0 2px 12px rgba(6,80,168,.06)",position:"sticky",top:0,zIndex:90},
    topTitle:{fontSize:17,fontWeight:700,color:"#0650a8",flex:1},
    topSub:{color:"#b0c2dc",fontWeight:400,fontSize:13,marginLeft:8},
    content:{flex:1,padding:"22px 24px",overflowY:"auto"},
    statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22},
    statCard:{background:"#fff",borderRadius:13,padding:"18px 20px",boxShadow:"0 4px 24px rgba(6,80,168,.1)",display:"flex",alignItems:"center",gap:14},
    statIco:(bg,c)=>({width:50,height:50,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,background:bg,color:c,flexShrink:0}),
    statVal:{fontSize:26,fontWeight:800,lineHeight:1},
    statLbl:{fontSize:11,color:"#b0c2dc",marginTop:3,fontWeight:500},
    panel:{background:"#fff",borderRadius:13,padding:22,boxShadow:"0 4px 24px rgba(6,80,168,.1)",marginBottom:18},
    panelTitle:{fontSize:14,fontWeight:700,color:"#0650a8",marginBottom:16,display:"flex",alignItems:"center",gap:7},
    grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18},
    camBox:{background:"#0d1b2e",borderRadius:10,aspectRatio:"16/9",position:"relative",marginBottom:12,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"rgba(255,255,255,.4)"},
    plateDisplay:{background:"linear-gradient(135deg,#ffd700,#ffb300)",border:"4px solid #cc8800",borderRadius:8,fontFamily:"'JetBrains Mono',monospace",fontSize:28,fontWeight:700,color:"#1a1a1a",textAlign:"center",padding:"9px 20px",letterSpacing:6,display:"inline-block",minWidth:170,boxShadow:"0 4px 16px rgba(204,136,0,.3)"},
    statusBox:(tipo)=>({borderRadius:10,padding:"14px 18px",margin:"12px 0",display:"flex",alignItems:"center",gap:12,fontWeight:600,
      background:tipo==="allowed"?"#e6f9f1":tipo==="denied"?"#fef0ef":"#e8f2ff",
      color:tipo==="allowed"?"#15a86b":tipo==="denied"?"#e0271a":"#0650a8",
      border:`1.5px solid ${tipo==="allowed"?"#a3e6cb":tipo==="denied"?"#fac9c5":"#b5d4f7"}`}),
    ficha:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14},
    fichaRow:{display:"flex",flexDirection:"column",background:"#f4f7fc",borderRadius:8,padding:"9px 11px"},
    fichaLbl:{fontSize:9,fontWeight:700,color:"#b0c2dc",textTransform:"uppercase",letterSpacing:.8,marginBottom:2},
    fichaVal:{fontSize:13,fontWeight:600},
    btn:(bg,c,hov)=>({display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 18px",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",border:"none",background:bg,color:c,transition:"all .2s",fontFamily:"inherit"}),
    btnGroup:{display:"flex",gap:9,flexWrap:"wrap"},
    formGroup:{marginBottom:13},
    formLabel:{fontSize:11,fontWeight:700,color:"#0d1b2e",marginBottom:4,display:"block",textTransform:"uppercase",letterSpacing:.6},
    formControl:{width:"100%",padding:"9px 12px",border:"1.5px solid #e2eaf5",borderRadius:8,fontFamily:"inherit",fontSize:13,background:"#fff",color:"#0d1b2e",outline:"none",boxSizing:"border-box"},
    formRow:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11},
    pill:(bg,c)=>({display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:bg,color:c}),
    badge:(bg,c)=>({display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:999,fontSize:10,fontWeight:700,background:bg,color:c,marginRight:4}),
    tbl:{width:"100%",borderCollapse:"collapse",fontSize:12},
    th:{padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"#0650a8",background:"#e8f2ff",whiteSpace:"nowrap"},
    td:{padding:"10px 13px",borderBottom:"1px solid #e2eaf5"},
    notiPanel:{position:"fixed",top:62,right:0,width:320,height:"calc(100vh - 62px)",background:"#fff",boxShadow:"-4px 0 24px rgba(6,80,168,.12)",display:"flex",flexDirection:"column",zIndex:150,transition:"transform .25s",overflow:"hidden"},
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.3)",zIndex:100},
    modal:{position:"fixed",inset:0,background:"rgba(13,27,46,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"},
    modalBox:{background:"#fff",borderRadius:14,padding:26,width:"min(580px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 16px 64px rgba(6,80,168,.2)"},
  };

  const NavBtn = ({id,icon,label,badge:b}) => (
    <button style={s.navBtn(section===id)} onClick={()=>{setSection(id);setSidebarOpen(false)}}>
      <span>{icon}</span><span>{label}</span>
      {b>0&&<span style={{marginLeft:"auto",background:"#e0271a",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:999}}>{b}</span>}
    </button>
  );

  const Btn = ({children,onClick,color="primary",size="md",disabled}) => {
    const colors={primary:["#0650a8","#fff"],success:["#15a86b","#fff"],danger:["#e0271a","#fff"],outline:["transparent","#0650a8"]};
    const [bg,c] = colors[color]||colors.primary;
    const pad = size==="sm"?"7px 13px":"10px 18px";
    return <button style={{...s.btn(bg,c),padding:pad,border:color==="outline"?"2px solid #0650a8":"none",opacity:disabled?.5:1}} onClick={onClick} disabled={disabled}>{children}</button>;
  };

  const StatCard = ({ico,val,lbl,ibg,ic}) => (
    <div style={s.statCard}>
      <div style={s.statIco(ibg,ic)}>{ico}</div>
      <div><div style={s.statVal}>{val}</div><div style={s.statLbl}>{lbl}</div></div>
    </div>
  );
  
  



const activarCamara = async () => {
  try {
    // ✅ Cerrar stream previo REAL
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }, // ✅ CORRECTO
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    streamRef.current = stream;              // ✅ CLAVE
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setCameraOn(true);

  } catch (err) {
    console.error("Error cámara:", err);
    setCameraError("No se pudo acceder a la cámara trasera");
  }
};


  
  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  };


  const capturarFrame = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (!video || !canvas) return null;

  const w = video.videoWidth;
  const h = video.videoHeight;

  canvas.width = 640;
  canvas.height = 200;

  const ctx = canvas.getContext("2d");

  // 🔥 RECORTE CENTRAL (zona donde SIEMPRE está la placa)
  ctx.drawImage(
    video,
    w * 0.15, h * 0.35,      // x, y
    w * 0.7,  h * 0.35,      // ancho, alto
    0, 0,
    canvas.width,
    canvas.height
  );
  
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -w, 0, w, h);
  ctx.restore();



  // Blanco y negro agresivo
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const b = v > 130 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = b;
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};


const cambiarCamara = async (modo) => {
  if (videoRef.current?.srcObject) {
    videoRef.current.srcObject.getTracks().forEach(t => t.stop());
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: modo },
    audio: false
  });

  videoRef.current.srcObject = stream;
};

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f4f7fc}
        ::-webkit-scrollbar-thumb{background:#b0c2dc;border-radius:3px}
        button:hover{opacity:.88}
        @media(max-width:700px){
          .sidebar-desktop{display:none!important}
          .stats-grid{grid-template-columns:1fr 1fr!important}
          .acceso-grid{grid-template-columns:1fr!important}
          .form-row-2{grid-template-columns:1fr!important}
          .ficha-grid{grid-template-columns:1fr!important}
          .main-content{padding:14px!important}
        }
        @media(max-width:900px){
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
        }
        .ocr-scan{animation:scan 1s ease-in-out infinite alternate}
        @keyframes scan{from{box-shadow:0 0 0 0 rgba(61,155,255,.6)}to{box-shadow:0 0 0 8px rgba(61,155,255,0)}}
        .pulse{animation:pulse 1.5s ease infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar-desktop" style={{...s.sidebar,position:"sticky",top:0,height:"100vh"}}>
        <div style={s.logo}>
          <div style={s.logoIco}>🚗</div>
          <h1 style={s.logoH}>PARQUEADERO<br/>LA ESPERANZA</h1>
          <p style={s.logoP}>Sistema Inteligente de Acceso</p>
        </div>
        <nav style={s.nav}>
          <div style={s.navSec}>Principal</div>
          {navItems.slice(0,2).map(n=><NavBtn key={n.id} {...n} badge={n.id==="acceso"?noLeidas:0}/>)}
          <div style={s.navSec}>Gestión</div>
          {navItems.slice(2,5).map(n=><NavBtn key={n.id} {...n}/>)}
          <div style={s.navSec}>Herramientas</div>
          {navItems.slice(5).map(n=><NavBtn key={n.id} {...n}/>)}
        </nav>
        <div style={s.foot}>
          <div style={s.clock}>
            <div style={s.clockTime}>{now.toLocaleTimeString("es-CO")}</div>
            <div style={s.clockDate}>{DIAS_FULL[now.getDay()]}, {now.getDate()} {meses[now.getMonth()]} {now.getFullYear()}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={s.main}>
        <div style={s.topbar}>
          <div style={s.topTitle}>
            {navItems.find(n=>n.id===section)?.label||"Panel"}
            <span style={s.topSub}>Parqueadero La Esperanza</span>
          </div>
          <button style={{position:"relative",width:40,height:40,borderRadius:10,border:"none",background:"#e8f2ff",color:"#0650a8",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setNotiOpen(o=>!o)}>
            🔔
            {noLeidas>0&&<span style={{position:"absolute",top:6,right:6,width:8,height:8,background:"#e0271a",borderRadius:"50%",border:"2px solid #fff"}}/>}
          </button>
        </div>

        <div className="main-content" style={s.content}>

          {/* ──── ACCESO ──── */}
          {section==="acceso"&&(
            <div>
              <div className="stats-grid" style={{...s.statsGrid}}>
                <StatCard ico="🚗" val={stats.total} lbl="Vehículos Registrados" ibg="#e8f2ff" ic="#0650a8"/>
                <StatCard ico="🟢" val={stats.hoy} lbl="Ingresos Hoy" ibg="#e6f9f1" ic="#15a86b"/>
                <StatCard ico="🅿️" val={Math.max(0,stats.enParq)} lbl="En Parqueadero" ibg="#fff8e6" ic="#f59e0b"/>
                <StatCard ico="🚫" val={stats.denegados} lbl="Denegados Hoy" ibg="#fef0ef" ic="#e0271a"/>
              </div>
              <div className="acceso-grid" style={s.grid2}>
                {/* Cámara OCR */}
                <div style={s.panel}>
                  <div style={s.panelTitle}>📷 Reconocimiento OCR — Placa</div>
                  
                  <div style={s.camBox}>
                    {!cameraOn ? (
                      <>
                        <div style={{ fontSize: 36 }}>📷</div>
                        <div style={{ fontSize: 12 }}>Cámara desactivada</div>
                        
                          
                          <button
                            onClick={activarCamara}
                            style={{
                              padding: "10px 18px",
                              borderRadius: 8,
                              border: "none",
                              background: "#0650a8",
                              color: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            🎥 Activar Cámara
                          </button>



                        {cameraError && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "#e0271a" }}>
                            {cameraError}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        
                        
                      {cameraOn && (
                        <div style={{ position: "relative" }}>
                          <video
                            ref={videoRef}
                            muted
                            autoPlay
                            playsInline
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: 10,
                            }}
                          />

                          {/* ✅ BOTONES DE CÁMARA */}
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              marginTop: 10,
                              justifyContent: "center",
                            }}
                          >
                            
                            <button onClick={() => cambiarCamara("environment")}>Trasera</button>
                            <button onClick={() => cambiarCamara("user")}>Frontal</button>

                          </div>
                        </div>
                      )}


                        
                        
                        {/* ✅ CANVAS OCULTO PARA OCR */}
                            <canvas
                              ref={canvasRef}
                              style={{ display: "none" }}
                            />

                        <Btn color="danger" size="sm" onClick={detenerCamara}>
                          ⛔ Apagar Cámara
                        </Btn>
                      </>
                    )}
                  </div>

                  <div style={{textAlign:"center",marginBottom:14}}>
                    <div style={{fontSize:9,fontWeight:700,color:"#b0c2dc",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Placa Detectada</div>
                    <div style={s.plateDisplay}>{inputPlaca||"— — — — — —"}</div>
                  </div>
                  <div style={s.btnGroup}>
                    
                    <Btn onClick={realizarOCR} disabled={ocrSimulando}>
                      📸 {ocrSimulando ? "Analizando..." : "Capturar OCR"}
                    </Btn>

                    <Btn color="outline" onClick={()=>{setInputPlaca("");setFichaV(null);setAccessStatus({tipo:"pending",titulo:"Ingrese o capture una placa",motivo:""})}}>🔄 Limpiar</Btn>
                  </div>
                  <div style={{marginTop:10,fontSize:11,color:"#b0c2dc",background:"#f4f7fc",borderRadius:8,padding:"8px 11px"}}>
                    💡 <b>Demo:</b> El OCR simula detección aleatoria de las placas registradas. En producción usa cámara real.
                  </div>
                </div>

                {/* Verificación */}
                <div style={s.panel}>
                  <div style={s.panelTitle}>🛡️ Verificación y Registro</div>
                  <div style={s.formGroup}>
                    <label style={s.formLabel}>Placa del Vehículo</label>
                    <input style={{...s.formControl,fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,textTransform:"uppercase",letterSpacing:4,textAlign:"center",background:"#f4f7fc"}}
                      value={inputPlaca} maxLength={6}
                      onChange={e=>{const v=e.target.value.toUpperCase();setInputPlaca(v);if(v.length>=3)buscarPlaca(v)}}
                      placeholder="ABC123"/>
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.formLabel}>Tipo de Movimiento</label>
                    <select style={s.formControl} value={tipoMov} onChange={e=>setTipoMov(e.target.value)}>
                      <option value="ENTRADA">🟢 ENTRADA</option>
                      <option value="SALIDA">🔴 SALIDA</option>
                    </select>
                  </div>

                  <div style={s.statusBox(accessStatus.tipo)}>
                    <span style={{fontSize:22}}>{accessStatus.tipo==="allowed"?"✅":accessStatus.tipo==="denied"?"❌":"ℹ️"}</span>
                    <div>
                      <div>{accessStatus.titulo}</div>
                      {accessStatus.motivo&&<div style={{fontSize:11,opacity:.8,marginTop:2}}>{accessStatus.motivo}</div>}
                    </div>
                  </div>

                  {fichaV&&(
                    <div className="ficha-grid" style={s.ficha}>
                      {[["Propietario",fichaV.propietario],["Residente",fichaV.residente],["Torre",fichaV.torre],["Apto",fichaV.apto],["Tipo",fichaV.tipo],["Contacto",fichaV.correo||fichaV.whatsapp||"—"]].map(([l,v])=>(
                        <div key={l} style={s.fichaRow}><span style={s.fichaLbl}>{l}</span><span style={s.fichaVal}>{v||"—"}</span></div>
                      ))}
                      <div style={{...s.fichaRow,gridColumn:"1/-1"}}>
                        <span style={s.fichaLbl}>Restricciones</span>
                        <span>
                          {fichaV.mensualidad_atrasada&&<span style={s.badge("#fff3cd","#856404")}>⚠ Mora {fichaV.meses_atrasados}m</span>}
                          {fichaV.conflicto_convivencia&&<span style={s.badge("#fef0ef","#e0271a")}>⛔ Convivencia</span>}
                          {!fichaV.mensualidad_atrasada&&!fichaV.conflicto_convivencia&&<span style={s.badge("#e6f9f1","#15a86b")}>✓ Sin restricciones</span>}
                        </span>
                      </div>
                      {fichaV.observaciones&&<div style={{...s.fichaRow,gridColumn:"1/-1"}}><span style={s.fichaLbl}>Observaciones</span><span style={{...s.fichaVal,fontSize:11,color:"#e0271a"}}>{fichaV.observaciones}</span></div>}
                    </div>
                  )}

                  <div style={{...s.btnGroup,marginTop:14}}>
                    <Btn color="success" onClick={registrarIngreso}>✅ Registrar {tipoMov}</Btn>
                    <Btn color="outline" onClick={abrirModalNuevo}>➕ Nuevo</Btn>
                  </div>
                  {lastIngreso&&(
                    <div style={{...s.btnGroup,marginTop:10}}>
                      
                      <Btn color="outline" size="sm" onClick={imprimirTiquete}>
                        🖨️ Imprimir Tiquete
                      </Btn>

                                            
                      <Btn color="outline" size="sm" onClick={generarPDF}>
                        📄 Ver PDF
                      </Btn>

                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──── DASHBOARD ──── */}
          {section==="dashboard"&&(
            <div>
              <div className="stats-grid" style={s.statsGrid}>
                <StatCard ico="🚗" val={stats.total} lbl="Total Vehículos" ibg="#e8f2ff" ic="#0650a8"/>
                <StatCard ico="🟢" val={stats.hoy} lbl="Ingresos Hoy" ibg="#e6f9f1" ic="#15a86b"/>
                <StatCard ico="🅿️" val={Math.max(0,stats.enParq)} lbl="En Parqueadero" ibg="#fff8e6" ic="#f59e0b"/>
                <StatCard ico="🚫" val={stats.denegados} lbl="Denegados Hoy" ibg="#fef0ef" ic="#e0271a"/>
              </div>
              <div style={s.panel}>
                <div style={s.panelTitle}>🕐 Últimos Movimientos</div>
                <div style={{overflowX:"auto"}}>
                  <table style={s.tbl}>
                    <thead><tr>{["Placa","Tipo","Propietario","Apto","Fecha/Hora","Estado","Tiquete"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {ingresos.slice(0,10).map(i=>(
                        <tr key={i.id}>
                          <td style={s.td}><b style={{fontFamily:"'JetBrains Mono',monospace"}}>{i.placa}</b></td>
                          <td style={s.td}><span style={s.pill(i.tipo==="ENTRADA"?"#e6f9f1":"#e8f2ff",i.tipo==="ENTRADA"?"#15a86b":"#0650a8")}>{i.tipo}</span></td>
                          <td style={s.td}>{i.propietario}</td>
                          <td style={s.td}>{i.apto}</td>
                          <td style={s.td}><small>{i.fecha_hora}</small></td>
                          <td style={s.td}><span style={s.pill(i.permitido?"#e6f9f1":"#fef0ef",i.permitido?"#15a86b":"#e0271a")}>{i.permitido?"✓ OK":"✗ Neg."}</span></td>
                          <td style={s.td}><Btn size="sm" color="outline" onClick={()=>toast(`🖨️ Tiquete #${String(i.id).padStart(6,"0")} — ${i.placa}`,"success")}>🖨️</Btn></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──── VEHÍCULOS ──── */}
          {section==="vehiculos"&&(
            <div>
              <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
                <input style={{...s.formControl,maxWidth:250}} placeholder="🔍 Buscar placa, propietario..." value={buscarQ} onChange={e=>setBuscarQ(e.target.value)}/>
                <Btn onClick={abrirModalNuevo}>➕ Nuevo Vehículo</Btn>
              </div>
              <div style={s.panel}>
                <div style={{overflowX:"auto"}}>
                  <table style={s.tbl}>
                    <thead><tr>{["Placa","Propietario / Residente","Apto","Torre","Tipo","Estado","Restricciones","Acciones"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filtradosV.map(v=>(
                        <tr key={v.id}>
                          <td style={s.td}><b style={{fontFamily:"'JetBrains Mono',monospace",background:"#ffd700",padding:"2px 8px",borderRadius:5,fontSize:13}}>{v.placa}</b></td>
                          <td style={s.td}><b>{v.propietario||"—"}</b>{v.residente&&v.residente!==v.propietario&&<div style={{fontSize:10,color:"#b0c2dc"}}>{v.residente}</div>}</td>
                          <td style={s.td}>{v.apto||"—"}</td>
                          <td style={s.td}>{v.torre||"—"}</td>
                          <td style={s.td}><span style={s.pill("#e8f2ff","#0650a8")}>{v.tipo}</span></td>
                          <td style={s.td}><span style={s.pill(v.activo?"#e6f9f1":"#fef0ef",v.activo?"#15a86b":"#e0271a")}>{v.activo?"Activo":"Inactivo"}</span></td>
                          <td style={s.td}>
                            {v.mensualidad_atrasada&&<span style={s.badge("#fff3cd","#856404")}>⚠ Mora {v.meses_atrasados}m</span>}
                            {v.conflicto_convivencia&&<span style={s.badge("#fef0ef","#e0271a")}>⛔ Conv.</span>}
                            {!v.mensualidad_atrasada&&!v.conflicto_convivencia&&<span style={s.badge("#e6f9f1","#15a86b")}>✓ Libre</span>}
                          </td>
                          <td style={s.td}>
                            <Btn size="sm" color="outline" onClick={()=>abrirModalEditar(v)}>✏️</Btn>
                            <span style={{marginLeft:4}}><Btn size="sm" color="danger" onClick={()=>eliminarV(v.id,v.placa)}>🗑️</Btn></span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──── HISTORIAL ──── */}
          {section==="ingresos"&&(
            <div style={s.panel}>
              <div style={s.panelTitle}>📋 Historial de Ingresos/Salidas</div>
              <div style={{overflowX:"auto"}}>
                <table style={s.tbl}>
                  <thead><tr>{["#","Placa","Tipo","Propietario","Apto","Fecha/Hora","Estado","Motivo Negación","Tiquete"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {ingresos.map(i=>(
                      <tr key={i.id}>
                        <td style={s.td}><small style={{color:"#b0c2dc"}}>{i.id}</small></td>
                        <td style={s.td}><b style={{fontFamily:"'JetBrains Mono',monospace"}}>{i.placa}</b></td>
                        <td style={s.td}><span style={s.pill(i.tipo==="ENTRADA"?"#e6f9f1":"#e8f2ff",i.tipo==="ENTRADA"?"#15a86b":"#0650a8")}>{i.tipo}</span></td>
                        <td style={s.td}>{i.propietario}</td>
                        <td style={s.td}>{i.apto}</td>
                        <td style={s.td}><small>{i.fecha_hora}</small></td>
                        <td style={s.td}><span style={s.pill(i.permitido?"#e6f9f1":"#fef0ef",i.permitido?"#15a86b":"#e0271a")}>{i.permitido?"✓ OK":"✗ Neg."}</span></td>
                        <td style={s.td}><small style={{color:"#e0271a"}}>{i.motivo_negacion||""}</small></td>
                        <td style={s.td}><Btn size="sm" color="outline" onClick={()=>toast(`Tiquete #${String(i.id).padStart(6,"0")} — ${i.placa}`,"success")}>🖨️</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ──── CELDAS ──── */}
          {section==="celdas"&&(
            <div style={s.panel}>
              <div style={s.panelTitle}>🅿️ Mapa de Celdas del Parqueadero</div>
              <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
                <span style={s.badge("#e6f9f1","#15a86b")}>🟢 Disponible: {celdas.filter(c=>!c.ocupada).length}</span>
                <span style={s.badge("#fef0ef","#e0271a")}>🔴 Ocupada: {celdas.filter(c=>c.ocupada).length}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(72px,1fr))",gap:8}}>
                {celdas.map(c=>(
                  <div key={c.id} style={{background:c.ocupada?"#fef0ef":"#e6f9f1",border:`2px solid ${c.ocupada?"#e0271a":"#15a86b"}`,borderRadius:8,padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:700,cursor:"pointer"}}
                    onClick={()=>toast(`Celda ${c.codigo} — Torre ${c.torre} Apto ${c.apto} — ${c.ocupada?"OCUPADA":"LIBRE"}`,c.ocupada?"error":"success")}>
                    <div style={{fontSize:16}}>{c.ocupada?"🔴":"🟢"}</div>
                    <div>{c.codigo}</div>
                    <div style={{fontWeight:400,color:"#b0c2dc",fontSize:9}}>T{c.torre}-{c.apto}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──── PICO Y PLACA ──── */}
          {section==="pico"&&(
            <div>
              <div style={s.panel}>
                <div style={s.panelTitle}>🚦 Pico y Placa — Bogotá</div>
                <p style={{fontSize:12,color:"#b0c2dc",marginBottom:16}}>Horarios: 6:00–9:00 am y 3:00–7:00 pm</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
                  {[1,2,3,4,5].map(d=>(
                    <div key={d} style={{background:"#fff",border:`1px solid ${d===now.getDay()?"#0650a8":"#e2eaf5"}`,borderRadius:10,padding:"14px 8px",textAlign:"center",borderTop:`4px solid ${d===now.getDay()?"#0650a8":"#e2eaf5"}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:d===now.getDay()?"#0650a8":"#b0c2dc",textTransform:"uppercase",marginBottom:8}}>{DIAS_FULL[d]}</div>
                      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                        {(PICO[d-1]||[]).map(n=><div key={n} style={{width:28,height:28,borderRadius:7,background:d===now.getDay()?"#0650a8":"#e2eaf5",color:d===now.getDay()?"#fff":"#0d1b2e",fontWeight:800,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</div>)}
                      </div>
                      {d===now.getDay()&&<div style={{fontSize:9,color:"#0650a8",marginTop:6,fontWeight:700}}>HOY</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={s.panel}>
                <div style={s.panelTitle}>🔍 Verificar Placa</div>
                <div className="form-row-2" style={s.formRow}>
                  <div><input style={{...s.formControl,fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,textTransform:"uppercase",letterSpacing:4,textAlign:"center"}} placeholder="ABC123" maxLength={6} value={picoInput} onChange={e=>setPicoInput(e.target.value.toUpperCase())}/></div>
                  <div><Btn onClick={verificarPico}>🔍 Verificar</Btn></div>
                </div>
                {picoRes&&(
                  <div style={{...s.statusBox(picoRes.afectada?"denied":"allowed"),marginTop:14}}>
                    <span style={{fontSize:22}}>{picoRes.afectada?"⚠️":"✅"}</span>
                    <div>
                      <div>Placa <b>{picoRes.placa}</b> — {picoRes.afectada?"TIENE PICO Y PLACA HOY":"Sin restricción hoy"}</div>
                      {picoRes.afectada&&<div style={{fontSize:11,opacity:.8,marginTop:2}}>Dígito {picoRes.placa.slice(-1)} restringido — 6:00-9:00 y 15:00-19:00</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──── ARCHIVOS ──── */}
          {section==="archivos"&&(
            <div style={s.panel}>
              <div style={s.panelTitle}>📁 Buscar Placa en Archivos del Equipo</div>
              <p style={{fontSize:12,color:"#b0c2dc",marginBottom:16}}>Busca en archivos TXT, CSV, JSON, XLSX del sistema local.</p>
              <div className="form-row-2" style={{...s.formRow,marginBottom:14}}>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>Placa</label>
                  <input style={{...s.formControl,fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,textTransform:"uppercase",letterSpacing:4,textAlign:"center"}} placeholder="ABC123" maxLength={6} value={archivosPlaca} onChange={e=>setArchivosPlaca(e.target.value.toUpperCase())}/>
                </div>
                <div style={s.formGroup}>
                  <label style={s.formLabel}>Ruta</label>
                  <input style={s.formControl} placeholder="C:\Users\Admin o /home/usuario"/>
                </div>
              </div>
              <Btn onClick={buscarArchivos} disabled={archivosLoading}>{archivosLoading?"⏳ Buscando...":"🔍 Iniciar Búsqueda"}</Btn>
              {archivosRes!==null&&(
                <div style={{marginTop:16}}>
                  {archivosRes.length>0 ? (
                    <>
                      <p style={{fontWeight:600,marginBottom:8}}>✅ Encontrado en {archivosRes.length} archivo(s):</p>
                      {archivosRes.map((f,i)=>(
                        <div key={i} style={{background:"#f4f7fc",borderRadius:8,padding:"8px 12px",marginBottom:6,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#0a6edc",wordBreak:"break-all"}}>
                          📄 {f}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{...s.statusBox("pending"),marginTop:0}}>ℹ️ <span>No se encontró la placa en archivos del sistema</span></div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Notificaciones panel */}
      {notiOpen&&<div style={s.overlay} onClick={()=>setNotiOpen(false)}/>}
      <div style={{...s.notiPanel,transform:notiOpen?"translateX(0)":"translateX(100%)"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid #e2eaf5",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#0650a8"}}>🔔 Notificaciones</h3>
          <Btn size="sm" color="outline" onClick={()=>{setNotificaciones(p=>p.map(n=>({...n,leida:true})));toast("Todas marcadas como leídas","success")}}>Marcar leídas</Btn>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:12}}>
          {notificaciones.map(n=>(
            <div key={n.id} style={{display:"flex",gap:10,padding:11,borderRadius:10,marginBottom:7,background:n.leida?"#f4f7fc":"#e8f2ff",borderLeft:`3px solid ${n.leida?"#e2eaf5":"#0650a8"}`}}>
              <span style={{fontSize:18,flexShrink:0}}>{n.tipo==="PICO_PLACA"?"🚦":n.tipo==="DENEGADO"?"❌":"✅"}</span>
              <div>
                <div style={{fontSize:12,lineHeight:1.5}}>{n.mensaje}</div>
                <div style={{fontSize:10,color:"#b0c2dc",marginTop:3}}>{n.fecha}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Vehículo */}
      {modalV&&(
        <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setModalV(false)}>
          <div style={s.modalBox}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#0650a8"}}>{editV?"Editar":"Registrar"} Vehículo</h2>
              <button style={{background:"#e2eaf5",border:"none",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:14}} onClick={()=>setModalV(false)}>✕</button>
            </div>
            <div className="form-row-2" style={s.formRow}>
              <div style={s.formGroup}><label style={s.formLabel}>Placa *</label>
                <input style={{...s.formControl,fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,textTransform:"uppercase",letterSpacing:4,textAlign:"center"}} value={formV.placa} maxLength={6} readOnly={!!editV} onChange={e=>setFormV(p=>({...p,placa:e.target.value.toUpperCase()}))}/>
              </div>
              <div style={s.formGroup}><label style={s.formLabel}>Tipo</label>
                <select style={s.formControl} value={formV.tipo} onChange={e=>setFormV(p=>({...p,tipo:e.target.value}))}>
                  {["Carro","Moto","Camioneta","Bicicleta"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {[["Propietario","propietario","Nombre completo"],["Residente","residente","Nombre residente"]].map(([l,k,ph])=>(
              <div key={k} style={s.formGroup}><label style={s.formLabel}>{l}</label>
                <input style={s.formControl} placeholder={ph} value={formV[k]} onChange={e=>setFormV(p=>({...p,[k]:e.target.value}))}/>
              </div>
            ))}
            <div className="form-row-2" style={s.formRow}>
              {[["Torre","torre","A, B, 1..."],["Apartamento","apto","101, 202..."]].map(([l,k,ph])=>(
                <div key={k} style={s.formGroup}><label style={s.formLabel}>{l}</label>
                  <input style={s.formControl} placeholder={ph} value={formV[k]} onChange={e=>setFormV(p=>({...p,[k]:e.target.value}))}/>
                </div>
              ))}
            </div>
            <div className="form-row-2" style={s.formRow}>
              <div style={s.formGroup}><label style={s.formLabel}>Correo</label>
                <input style={s.formControl} type="email" placeholder="correo@ejemplo.com" value={formV.correo} onChange={e=>setFormV(p=>({...p,correo:e.target.value}))}/>
              </div>
              <div style={s.formGroup}><label style={s.formLabel}>WhatsApp</label>
                <input style={s.formControl} placeholder="573001234567" value={formV.whatsapp} onChange={e=>setFormV(p=>({...p,whatsapp:e.target.value}))}/>
              </div>
            </div>
            <div style={{background:"#f4f7fc",borderRadius:10,padding:14,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:10,textTransform:"uppercase"}}>⚠ Restricciones</div>
              <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
                <input type="checkbox" checked={formV.mensualidad_atrasada} onChange={e=>setFormV(p=>({...p,mensualidad_atrasada:e.target.checked}))} style={{width:16,height:16,accentColor:"#0650a8"}}/>
                <span style={{fontSize:13}}>Mensualidad Atrasada</span>
                <input type="number" min={0} max={24} value={formV.meses_atrasados} onChange={e=>setFormV(p=>({...p,meses_atrasados:parseInt(e.target.value)||0}))}
                  style={{marginLeft:"auto",width:70,padding:"3px 8px",border:"1.5px solid #e2eaf5",borderRadius:6,fontFamily:"inherit"}} placeholder="meses"/>
              </label>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={formV.conflicto_convivencia} onChange={e=>setFormV(p=>({...p,conflicto_convivencia:e.target.checked}))} style={{width:16,height:16,accentColor:"#0650a8"}}/>
                <span style={{fontSize:13}}>Conflicto de Convivencia</span>
              </label>
            </div>
            <div style={s.formGroup}><label style={s.formLabel}>Observaciones</label>
              <textarea style={{...s.formControl,resize:"vertical"}} rows={3} placeholder="Notas adicionales..." value={formV.observaciones} onChange={e=>setFormV(p=>({...p,observaciones:e.target.value}))}/>
            </div>
            <div style={s.btnGroup}>
              <Btn color="success" onClick={guardarVehiculo}>💾 Guardar</Btn>
              <Btn color="outline" onClick={()=>setModalV(false)}>Cancelar</Btn>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts}/>
    </div>
  );
}

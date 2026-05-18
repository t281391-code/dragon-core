import type { Metadata } from "next";
import Image from "next/image";
import { PrintButton } from "./PrintButton";
import styles from "./thesis.module.css";

export const metadata: Metadata = {
  title: "Дипломын ажил · KPI Dashboard систем",
  description: "Уул уурхайн тэсрэх бодисын үйлдвэрийн KPI Dashboard системийн дипломын танилцуулга",
};

const stack = [
  "HTML/CSS/JavaScript",
  "React + Next.js",
  "TypeScript",
  "Node API",
  "Prisma ORM",
  "Aiven MySQL",
  "JWT",
  "RBAC",
  "Vercel",
  "AI Agent",
];

const heroMetrics = [
  { label: "Role", value: "3", note: "Admin, Moderator, User" },
  { label: "Table", value: "14+", note: "relational schema" },
  { label: "Refresh", value: "5 сек", note: "dashboard update" },
  { label: "Deploy", value: "Vercel", note: "Aiven MySQL-тэй" },
];

const goals = [
  "Үйлдвэрлэл, агуулах, ХЭАБО, тээврийн KPI-г нэг системд төвлөрүүлэх",
  "Хэрэглэгч бүр зөвхөн өөрийн эрхтэй өгөгдөл дээр ажиллах",
  "Dashboard, CRUD, filter, pagination, report workflow-г бодит систем шиг хийх",
  "AI туслахыг зөвшөөрөгдсөн action хийх agent хэлбэрээр холбох",
];

const problems = [
  { title: "Өгөгдөл салангид", body: "Excel, чат, цаасан бүртгэл дээр KPI тарах үед удирдлага удааширна." },
  { title: "Шуурхай хяналт дутуу", body: "RPM, үйлдвэрлэл, safety incident зэрэг мэдээлэл нэг дэлгэц дээр харагдахгүй." },
  { title: "Эрхийн ялгаа хэрэгтэй", body: "Admin, moderator, user бүр өөр түвшний эрхтэй байх ёстой." },
  { title: "Тайлан гараар гардаг", body: "Хайлт, шүүлт, pagination, dashboard summary автомат байх шаардлагатай." },
];

const requirementRows = [
  { req: "Auth + security", solution: "Login/register/logout, JWT, password hash, Zod, .env", status: "Хийгдсэн" },
  { req: "RBAC", solution: "Admin, Moderator, User + department access", status: "Хийгдсэн" },
  { req: "CRUD", solution: "Users, materials, production logs, safety incidents, transports", status: "Хийгдсэн" },
  { req: "REST API", solution: "Next.js route handler-ууд `/api/...` бүтэцтэй", status: "Хийгдсэн" },
  { req: "SQL", solution: "Aiven MySQL + Prisma relation, FK, index", status: "Хийгдсэн" },
  { req: "AI Agent", solution: "OpenAI tool calling, DB query, create/delete action, audit log", status: "Хийгдсэн" },
  { req: "Python", solution: "PDF/report automation script ашигласан", status: "Нэмэлт" },
  { req: "Figma/UI", solution: "Wireframe, high fidelity, responsive design system-д бэлдсэн", status: "Оруулах" },
  { req: "Docker", solution: "Одоогийн deploy Vercel + Aiven. Docker-г дараагийн сайжруулалт гэж тайлбарлана", status: "Дутуу" },
];

const tables = [
  { name: "User", fields: ["roleId", "departmentId", "passwordHash", "isActive"] },
  { name: "Role", fields: ["ADMIN", "MODERATOR", "USER"] },
  { name: "Department", fields: ["WAREHOUSE", "PRODUCTION", "SAFETY", "LOGISTICS"] },
  { name: "Material", fields: ["currentStock", "minimumStock", "location"] },
  { name: "ProductionLog", fields: ["lotNumber", "outputQuantity", "materialId"] },
  { name: "EquipmentTelemetryLog", fields: ["rpm", "loadPercent", "status", "recordedAt"] },
  { name: "SafetyIncident", fields: ["severity", "status", "incidentDate"] },
  { name: "AiAgentAuditLog", fields: ["toolName", "actionType", "success"] },
];

const securityItems = [
  { label: "JWT authentication", body: "Session cookie болон middleware/proxy дээр protected route шалгана." },
  { label: "Password hashing", body: "Нууц үг plaintext биш, one-way hash хэлбэрээр хадгалагдана." },
  { label: "Zod validation", body: "Auth, CRUD, AI tool argument дээр type, length, range шалгана." },
  { label: "SQL injection хамгаалалт", body: "Prisma ORM parameterized query ашиглаж raw string SQL-ээс зайлсхийсэн." },
  { label: "Basic XSS хамгаалалт", body: "React text rendering, controlled input, safe UI state ашиглаж user text-ийг шууд HTML болгохгүй." },
  { label: "Rate limiting", body: "Login, register, CRUD, AI route дээр sliding-window limit хэрэглэсэн." },
  { label: "Environment variables", body: "DATABASE_URL, JWT_SECRET, OPENAI_API_KEY зэрэг secret-үүдийг `.env` болон deploy dashboard дээр хадгална." },
  { label: "AI guardrail", body: "AI action бүр backend permission болон audit log-той." },
];

const featureRows = [
  { name: "Admin dashboard", value: "Бүх module, user role, report хянана" },
  { name: "User dashboard", value: "Өөрийн department-ийн мэдээлэлтэй ажиллана" },
  { name: "Search/filter", value: "Table, report, incident, logistics дээр ашигласан" },
  { name: "Pagination", value: "Их хэмжээний жагсаалтыг хуудсаар харуулна" },
  { name: "Real-time update", value: "SWR refresh + mutation дараах cache update" },
  { name: "Telemetry", value: "RPM, load, status, warning/critical төлөв" },
];

const testResults = [
  { title: "Бүтээлт", value: "OK", body: "Next.js production build амжилттай." },
  { title: "Нэвтрэлт", value: "OK", body: "Login, logout, protected route шалгасан." },
  { title: "Responsive", value: "OK", body: "Mobile layout, modal, table зассан." },
  { title: "API", value: "OK", body: "CRUD болон RPM summary endpoint ажилласан." },
];

const docs = [
  "README.md: setup, env, deploy тайлбар",
  "Architecture diagram: энэ thesis-ийн architecture page",
  "API overview: route, permission, validation mapping",
  "Database schema diagram: ER diagram page",
];

function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span>{number}</span>
      <strong>{title}</strong>
    </div>
  );
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <article className={styles.miniCard}>
      <strong>{title}</strong>
      <p>{body}</p>
    </article>
  );
}

function FlowNode({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.flowNode}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export default function ThesisPage() {
  return (
    <main className={styles.thesisRoot}>
      <nav className={styles.topNav} aria-label="Дипломын бүлгүүд">
        <a href="#cover">Нүүр</a>
        <a href="#goal">Зорилго</a>
        <a href="#survey">Судалгаа</a>
        <a href="#requirements">Шаардлага</a>
        <a href="#architecture">Архитектур</a>
        <a href="#database">Өгөгдөл</a>
        <a href="#dashboard">KPI</a>
        <a href="#deployment">Байршилт</a>
        <PrintButton />
      </nav>

      <section id="cover" className={`${styles.page} ${styles.coverPage}`}>
        <Image className={styles.coverImage} src="/img/last.png" alt="Үйлдвэрийн KPI системийн нүүр зураг" fill priority sizes="100vw" />
        <div className={styles.coverShade} />
        <div className={styles.coverContent}>
          <div className={styles.badge}>Indra Cyber Institute · Final Practical Project 2026</div>
          <h1>Уул уурхайн тэсрэх бодисын үйлдвэрийн KPI Dashboard систем</h1>
          <p className={styles.lead}>
            Үйлдвэрлэл, агуулах, ХЭАБО, тээвэр, тоног төхөөрөмжийн RPM өгөгдлийг нэгтгэсэн fullstack dashboard.
          </p>
          <div className={styles.stackRow}>
            {stack.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className={styles.heroMetrics}>
            {heroMetrics.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="goal" className={styles.page}>
        <SectionLabel number="01" title="Төслийн зорилго" />
        <div className={styles.twoColumn}>
          <div>
            <h2>Гол зорилго</h2>
            <p className={styles.shortText}>
              Үйлдвэрийн өдөр тутмын шийдвэрийг realtime өгөгдөл, dashboard visualization, role-based access control дээр суурилуулах.
            </p>
            <div className={styles.goalList}>
              {goals.map((goal, index) => (
                <div key={goal} className={styles.goalItem}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{goal}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.visualPanel}>
            <div className={styles.factoryFrame}>
              <Image src="/img/Screenshot 2026-04-26 174929.png" alt="Үйлдвэрийн орчны зураг" fill sizes="(max-width: 900px) 100vw, 45vw" />
            </div>
            <div className={styles.calloutGrid}>
              <MiniCard title="Production level" body="Auth, API, DB, security, deploy бүгд нэг системд холбогдсон." />
              <MiniCard title="Ойлгомжтой UI" body="Том KPI карт, график, өнгө, table filter ашигласан." />
            </div>
          </div>
        </div>
      </section>

      <section id="survey" className={styles.page}>
        <SectionLabel number="02" title="Асуудлын тодорхойлолт ба судалгаа" />
        <h2>Dashboard хэрэгцээ судалгаагаар батлагдсан</h2>
        <div className={styles.problemGrid}>
          {problems.map((problem) => (
            <MiniCard key={problem.title} title={problem.title} body={problem.body} />
          ))}
        </div>
        <div className={styles.surveyGrid}>
          <figure className={styles.surveyCard}>
            <Image src="/img/survey-kpi-previous.png" alt="Өмнө KPI dashboard ашиглаж байсан эсэх судалгаа" fill sizes="(max-width: 900px) 100vw, 42vw" />
          </figure>
          <figure className={styles.surveyCard}>
            <Image src="/img/survey-kpi-need.png" alt="KPI dashboard ашиглах хэрэгцээний судалгаа" fill sizes="(max-width: 900px) 100vw, 42vw" />
          </figure>
          <div className={styles.surveyInsight}>
            <strong>84.8%</strong>
            <span>өмнө KPI dashboard ашиглаж байгаагүй</span>
            <p>Иймээс UI нь энгийн, хурдан ойлгогдох, role бүрд өөр workflow-той байх ёстой.</p>
          </div>
          <div className={styles.surveyInsight}>
            <strong>39.1%</strong>
            <span>dashboard сонирхож байна</span>
            <p>Хэрэглэгчдэд хэрэгцээ байгаа ч adoption хийхэд ойлгомжтой дизайн, сургалтын тайлбар хэрэгтэй.</p>
          </div>
        </div>
      </section>

      <section id="requirements" className={styles.page}>
        <SectionLabel number="03" title="Шаардлагын биелэлт" />
        <h2>Indra requirement-тэй тулгасан зураглал</h2>
        <div className={styles.requirementBoard}>
          {requirementRows.map((row) => (
            <article key={row.req} className={`${styles.requirementItem} ${row.status === "Дутуу" ? styles.requirementGap : ""}`}>
              <span>{row.status}</span>
              <strong>{row.req}</strong>
              <p>{row.solution}</p>
            </article>
          ))}
        </div>
        <div className={styles.calloutStrip}>
          <MiniCard title="Худал мэдээлэл оруулахгүй" body="Docker одоогийн Vercel/Aiven deploy-д ашиглагдаагүй. Хамгаалалт дээр дараагийн сайжруулалт гэж тайлбарлана." />
          <MiniCard title="Python нэмэлт" body="Танилцуулга/PDF automation script-үүдээр Python хэрэглэсэн." />
          <MiniCard title="Figma материал" body="Wireframe, high fidelity, responsive state, design system-г хамгаалалтын материалд хавсаргана." />
        </div>
      </section>

      <section id="architecture" className={styles.page}>
        <SectionLabel number="04" title="Системийн архитектур" />
        <h2>Next.js суурьтай modular fullstack бүтэц</h2>
        <div className={styles.architectureFlow}>
          <FlowNode title="Хэрэглэгч" body="React dashboard" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="App Router" body="Protected pages, layout" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="API layer" body="REST, validation, RBAC" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Prisma" body="DB interaction layer" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Aiven MySQL" body="Relational SQL database" />
        </div>
        <div className={styles.layerGrid}>
          <MiniCard title="Яагаад Next.js?" body="Frontend, API route, protected layout, deployment нэг codebase-д багтсан." />
          <MiniCard title="Trade-off" body="Microservice биш тул deploy энгийн. Ирээдүйд API-г тусад нь service болгож салгаж болно." />
          <MiniCard title="Maintainability" body="Module бүр page, API route, Prisma model, shared component гэсэн заагтай." />
          <MiniCard title="State management" body="useState, useMemo, SWR cache. Redux сонгоогүй нь complexity багасгасан." />
        </div>
      </section>

      <section id="database" className={styles.page}>
        <SectionLabel number="05" title="Database design ба RBAC" />
        <div className={styles.erLayout}>
          <div>
            <h2>ER диаграмм</h2>
            <div className={styles.erDiagram}>
              {tables.map((table) => (
                <div key={table.name} className={styles.erTable}>
                  <strong>{table.name}</strong>
                  {table.fields.map((field) => <span key={field}>{field}</span>)}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.relationNotes}>
            <MiniCard title="Normalization" body="User, Role, Department, Material, Log, Telemetry тусдаа table тул duplication багассан." />
            <MiniCard title="Foreign key" body="User → Role/Department, ProductionLog → Material, Telemetry → Equipment/ProductionLog." />
            <MiniCard title="Indexing" body="Date, status, materialId, equipmentId зэрэг query ихтэй багануудад index тавьсан." />
            <div className={styles.roleTree}>
              <div className={styles.roleAdmin}>Admin</div>
              <div className={styles.roleBranches}>
                <span>Moderator</span>
                <span>User</span>
              </div>
              <div className={styles.departmentRow}>
                <span>Агуулах</span>
                <span>Үйлдвэрлэл</span>
                <span>ХЭАБО</span>
                <span>Тээвэр</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.page}>
        <SectionLabel number="06" title="Authentication & Cyber Security" />
        <div className={styles.securityLayout}>
          <div>
            <h2>Хамгаалалтын үндсэн шийдлүүд</h2>
            <p className={styles.shortText}>
              Security-г зөвхөн UI дээр биш backend route, middleware, database action, AI tool function бүр дээр давхар шалгасан.
            </p>
            <div className={styles.securityGrid}>
              {securityItems.map((item) => (
                <MiniCard key={item.label} title={item.label} body={item.body} />
              ))}
            </div>
          </div>
          <div className={styles.securityFlow}>
            <FlowNode title="1. Login" body="Email + password validation" />
            <FlowNode title="2. JWT" body="Session cookie үүснэ" />
            <FlowNode title="3. Middleware" body="Protected route хамгаална" />
            <FlowNode title="4. API guard" body="Role + department дахин шалгана" />
            <FlowNode title="5. Audit" body="AI болон CRUD мөр үлдээнэ" />
          </div>
        </div>
      </section>

      <section id="dashboard" className={styles.page}>
        <SectionLabel number="07" title="KPI Dashboard ба RPM telemetry" />
        <div className={styles.dashboardLayout}>
          <div>
            <h2>Dashboard нь 5 секундэд ойлгогдох ёстой</h2>
            <p className={styles.shortText}>Том KPI карт, table, graph, badge ашиглаж өдөр тутмын мэдээллийг шууд харуулна.</p>
            <div className={styles.kpiGrid}>
              <div><span>Материал</span><strong>24.8 тн</strong><small>агуулахын үлдэгдэл</small></div>
              <div><span>Үйлдвэрлэл</span><strong>12.4 тн</strong><small>өдрийн гарц</small></div>
              <div><span>Incident</span><strong>0</strong><small>нээлттэй эрсдэл</small></div>
              <div><span>Telemetry</span><strong>5 сек</strong><small>SWR refresh</small></div>
            </div>
            <div className={styles.featureList}>
              {featureRows.map((row) => (
                <div key={row.name}><strong>{row.name}</strong><span>{row.value}</span></div>
              ))}
            </div>
          </div>
          <div className={styles.telemetryGraph}>
            <div className={styles.graphHeader}>
              <strong>RPM telemetry жишээ</strong>
              <span>анхааруулах шугам</span>
            </div>
            <svg viewBox="0 0 720 300" role="img" aria-label="RPM telemetry график">
              <defs>
                <linearGradient id="rpmFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className={styles.gridLine} d="M40 60 H690 M40 120 H690 M40 180 H690 M40 240 H690" />
              <path className={styles.areaLine} d="M40 236 C100 190 130 210 180 145 C230 85 270 110 320 96 C380 80 410 162 460 130 C520 92 580 76 690 96 L690 260 L40 260 Z" />
              <path className={styles.rpmLine} d="M40 236 C100 190 130 210 180 145 C230 85 270 110 320 96 C380 80 410 162 460 130 C520 92 580 76 690 96" />
              <path className={styles.warnLine} d="M40 118 H690" />
            </svg>
            <div className={styles.telemetryCards}>
              <MiniCard title="Өгөгдөл" body="RPM, loadPercent, temperature, pressure, vibration, status." />
              <MiniCard title="Performance" body="API response багасгахын тулд filter, limit, index ашигласан." />
            </div>
          </div>
        </div>
      </section>

      <section id="deployment" className={styles.page}>
        <SectionLabel number="08" title="AI Agent ба байршуулалт" />
        <div className={styles.twoColumn}>
          <div>
            <h2>Энгийн чат биш, action хийдэг agent</h2>
            <div className={styles.apiFlow}>
              <FlowNode title="Асуулт" body="Хэрэглэгч dashboard дээрээс асууна" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="Tool сонгох" body="AI ямар action хэрэгтэйг шийднэ" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="Permission" body="Role, department шалгана" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="DB action" body="Query, create, delete" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="Audit log" body="Үйлдэл бүр хадгалагдана" />
            </div>
          </div>
          <div>
            <h2>Бодит байршуулалт</h2>
            <div className={styles.deployDiagram}>
              <FlowNode title="GitHub" body="main branch" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="Vercel" body="Next.js app + API" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="Aiven" body="Managed MySQL" />
              <div className={styles.flowPulse}>→</div>
              <FlowNode title="Browser" body="HTTPS dashboard" />
            </div>
            <div className={styles.calloutStrip}>
              <MiniCard title="Environment variables" body="DATABASE_URL, JWT_SECRET, OPENAI_API_KEY repo-д биш deploy dashboard дээр." />
              <MiniCard title="Docker тайлбар" body="Docker одоогоор deploy-д байхгүй. Дараагийн хувилбарт Dockerfile + compose нэмнэ." />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.page}>
        <SectionLabel number="09" title="Туршилт, performance, documentation" />
        <div className={styles.deployLayout}>
          <div>
            <h2>Шалгалт ба үр дүн</h2>
            <div className={styles.resultGrid}>
              {testResults.map((item) => (
                <article key={item.title} className={styles.resultCard}>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
          <div>
            <h2>Хавсаргах материал</h2>
            <div className={styles.docsList}>
              {docs.map((item) => <div key={item}>{item}</div>)}
            </div>
            <div className={styles.calloutStrip}>
              <MiniCard title="Performance" body="Lazy loading, SWR cache, useMemo, pagination, indexed query ашигласан." />
              <MiniCard title="UI/UX" body="Responsive layout, dark industrial theme, typography, spacing, Figma-ready design system." />
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.page} ${styles.finalPage}`}>
        <SectionLabel number="10" title="Дүгнэлт" />
        <div className={styles.finalLayout}>
          <div>
            <h2>Энэ бол бодит workflow-той fullstack систем</h2>
            <p className={styles.shortText}>
              Төсөл нь зөвхөн UI биш. Authentication, RBAC, CRUD, REST API, SQL database, AI agent, telemetry, deployment, security requirement-уудыг нэг системд холбосон.
            </p>
            <div className={styles.conclusionGrid}>
              <MiniCard title="System thinking" body="Problem → database → API → UI → security → deployment гэсэн бүтэн урсгалтай." />
              <MiniCard title="Архитектурын шийдэл" body="Next.js modular fullstack бүтэц нь final project-ийн scope-д тохирсон." />
              <MiniCard title="Real workflow" body="Department dashboard, report, search, filter, pagination, AI action ажиллана." />
              <MiniCard title="Дараагийн сайжруулалт" body="Docker support, CI/CD test, Swagger, Figma link, telemetry alert өргөжүүлнэ." />
            </div>
          </div>
          <div className={styles.finalPoster}>
            <Image src="/img/Screenshot 2026-04-26 173225.png" alt="Уул уурхайн үйлдвэрлэлийн бодит орчин" fill sizes="(max-width: 900px) 100vw, 38vw" />
            <div>
              <strong>KPI Dashboard систем</strong>
              <span>Indra Cyber Institute · Final Practical Project 2026</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

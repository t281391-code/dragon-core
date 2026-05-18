import type { Metadata } from "next";
import Image from "next/image";
import { PrintButton } from "./PrintButton";
import styles from "./thesis.module.css";

export const metadata: Metadata = {
  title: "Дипломын ажил · KPI Dashboard систем",
  description: "Уул уурхайн тэсрэх бодисын үйлдвэрийн KPI Dashboard системийн дипломын танилцуулга",
};

const kpis = [
  { label: "Үйлдвэрлэл", value: "180+", note: "сүүлийн бүртгэл" },
  { label: "RPM өгөгдөл", value: "1000", note: "нэг хүсэлтээр авах дээд мөр" },
  { label: "Шинэчлэлт", value: "5 сек", note: "dashboard дахин таталт" },
  { label: "Эрх", value: "3", note: "Admin, Moderator, User" },
];

const stack = ["Next.js App Router", "TypeScript", "Prisma ORM", "Aiven MySQL", "JWT", "RBAC", "Vercel", "AI туслах"];

const problems = [
  { title: "Мэдээлэл тархай", body: "Үйлдвэрлэл, агуулах, аюулгүй байдал, тээвэр тусдаа харагддаг." },
  { title: "Шуурхай шийдвэр удаан", body: "Өдөр тутмын тоо, анхаарах эрсдэл гараар нэгтгэгддэг." },
  { title: "Хариуцлага бүдэг", body: "Хэн ямар бүртгэл хийсэн, ямар эрхтэй нь системээр ялгарах хэрэгтэй." },
  { title: "Тоног төхөөрөмжийн хяналт сул", body: "RPM, ачаалал, төлөвийг dashboard дээр нэг дор харах шаардлагатай." },
];

const goals = [
  "Үйлдвэрийн үндсэн KPI-г нэг дэлгэц дээр ойлгомжтой харуулах",
  "Хэлтэс бүр өөрийн өгөгдлөө бүртгэх, хайх, шүүх боломжтой болгох",
  "Эрхийн түвшнээр хамгаалсан бодит веб систем хөгжүүлэх",
  "AI туслахыг зөвхөн зөвшөөрсөн үйлдэл хийх байдлаар холбох",
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
  { label: "JWT session", body: "Нэвтэрсэн хэрэглэгчийн role, department шалгана." },
  { label: "Нууц үгийн hash", body: "Нууц үгийг шууд хадгалахгүй, нэг чиглэлтэй hash ашигласан." },
  { label: "Zod validation", body: "API оролтыг сервер дээр шалгана." },
  { label: "Давтамж хязгаарлалт", body: "Нэвтрэлт, AI, CRUD API дээр хүсэлтийн тоог хязгаарласан." },
  { label: "Prisma query", body: "SQL injection эрсдэлийг ORM layer дээр бууруулсан." },
  { label: "AI permission", body: "AI tool ажиллахдаа хэрэглэгчийн эрхийг дахин шалгана." },
];

const testResults = [
  { title: "Бүтээлт", value: "Амжилттай", body: "Next.js production build алдаагүй." },
  { title: "Нэвтрэлт", value: "Ажилласан", body: "Нэвтрэх, гарах, хамгаалсан route шалгагдсан." },
  { title: "Гар утас", value: "Сайжирсан", body: "ХЭАБО болон incident хэсэг responsive болсон." },
  { title: "Телеметри", value: "Ажилласан", body: "RPM summary API dashboard дээр харагдсан." },
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
          <div className={styles.badge}>Дипломын практик төсөл</div>
          <h1>Уул уурхайн тэсрэх бодисын үйлдвэрийн KPI Dashboard систем</h1>
          <p className={styles.lead}>
            Үйлдвэрлэл, агуулах, ХЭАБО, тээвэр, тоног төхөөрөмжийн RPM өгөгдлийг нэг dashboard дээр нэгтгэсэн веб систем.
          </p>
          <div className={styles.stackRow}>
            {stack.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className={styles.heroMetrics}>
            {kpis.map((item) => (
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
            <h2>Гол санаа</h2>
            <p className={styles.shortText}>
              Үйлдвэрийн өдөр тутмын шийдвэрийг тоон мэдээлэл дээр үндэслэдэг болгох.
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
              <MiniCard title="Нэг систем" body="Олон хэлтсийн мэдээлэл нэг dashboard дээр." />
              <MiniCard title="Шууд ойлгох" body="Карт, график, өнгөөр эрсдэлийг ялгана." />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.page}>
        <SectionLabel number="02" title="Асуудлын тодорхойлолт" />
        <h2>Яагаад энэ систем хэрэгтэй вэ?</h2>
        <div className={styles.problemGrid}>
          {problems.map((problem) => (
            <MiniCard key={problem.title} title={problem.title} body={problem.body} />
          ))}
        </div>
        <div className={styles.beforeAfter}>
          <div>
            <span>Өмнө</span>
            <strong>Гараар нэгтгэнэ</strong>
            <p>Мэдээлэл Excel, чат, цаасан бүртгэлд салангид үлддэг.</p>
          </div>
          <div className={styles.arrowLine}>→</div>
          <div>
            <span>Одоо</span>
            <strong>Dashboard дээр харна</strong>
            <p>Өгөгдөл API-аар ирж, dashboard state автоматаар шинэчлэгдэнэ.</p>
          </div>
        </div>
      </section>

      <section id="architecture" className={styles.page}>
        <SectionLabel number="03" title="Системийн архитектур" />
        <h2>Нэг урсгалтай ойлгомжтой бүтэц</h2>
        <div className={styles.architectureFlow}>
          <FlowNode title="Хэрэглэгч" body="Хөтөч дээрх dashboard" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Next.js App Router" body="Хуудас, layout, API route" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="API давхарга" body="Нэвтрэлт, validation, logic" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Prisma ORM" body="Төрөлтэй database query" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Aiven MySQL" body="Ажиллаж буй өгөгдлийн сан" />
        </div>
        <div className={styles.layerGrid}>
          <MiniCard title="Дэлгэц" body="React component, SWR refresh, responsive dashboard." />
          <MiniCard title="Сервер тал" body="Next.js route handler дотор REST API хэлбэрээр ажиллана." />
          <MiniCard title="Өгөгдлийн сан" body="Prisma schema-аар relation, index, migration удирдана." />
          <MiniCard title="AI" body="Tool calling хийж зөвшөөрсөн өгөгдөл уншиж, үйлдэл хийнэ." />
        </div>
      </section>

      <section id="database" className={styles.page}>
        <SectionLabel number="04" title="Өгөгдлийн сангийн бүтэц" />
        <h2>ER диаграмм</h2>
        <div className={styles.erLayout}>
          <div className={styles.erDiagram}>
            {tables.map((table) => (
              <div key={table.name} className={styles.erTable}>
                <strong>{table.name}</strong>
                {table.fields.map((field) => <span key={field}>{field}</span>)}
              </div>
            ))}
          </div>
          <div className={styles.relationNotes}>
            <MiniCard title="Үндсэн холбоо" body="User нь Role болон Department-тэй foreign key холбоотой." />
            <MiniCard title="Үйлдвэрлэл" body="ProductionLog нь Material болон EquipmentTelemetryLog-той холбогдоно." />
            <MiniCard title="Аюулгүй байдал" body="SafetyIncident болон SafetyRiskAssessment хэрэглэгчээр мөр үлдээнэ." />
            <MiniCard title="AI хяналт" body="AI tool бүр AiAgentAuditLog дээр бүртгэлтэй үлдэнэ." />
          </div>
        </div>
      </section>

      <section className={styles.page}>
        <SectionLabel number="05" title="Хэрэглэгчийн эрхийн систем ба аюулгүй байдал" />
        <div className={styles.securityLayout}>
          <div>
            <h2>Эрхийн шатлал</h2>
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
          <div className={styles.securityGrid}>
            {securityItems.map((item) => (
              <MiniCard key={item.label} title={item.label} body={item.body} />
            ))}
          </div>
        </div>
      </section>

      <section id="dashboard" className={styles.page}>
        <SectionLabel number="06" title="KPI Dashboard" />
        <div className={styles.dashboardLayout}>
          <div>
            <h2>Багш 5 секундэд ойлгох дэлгэц</h2>
            <p className={styles.shortText}>Том тоо, өнгө, төлөв, график ашиглаж өдөр тутмын байдлыг шууд харуулна.</p>
            <div className={styles.kpiGrid}>
              <div><span>Материал</span><strong>24.8 тн</strong><small>агуулахын үлдэгдэл</small></div>
              <div><span>Үйлдвэрлэл</span><strong>12.4 тн</strong><small>өнөөдрийн гарц</small></div>
              <div><span>Incident</span><strong>0</strong><small>нээлттэй эрсдэл</small></div>
              <div><span>Тээвэр</span><strong>8</strong><small>идэвхтэй рейс</small></div>
            </div>
          </div>
          <div className={styles.dashboardShot}>
            <div className={styles.browserTop}><span /><span /><span /></div>
            <div className={styles.fakeSidebar} />
            <div className={styles.fakeDashboard}>
              <div className={styles.fakeHeader} />
              <div className={styles.fakeCards}>
                <i /><i /><i />
              </div>
              <div className={styles.fakeChart}>
                <svg viewBox="0 0 420 150" role="img" aria-label="KPI график">
                  <path d="M10 120 C80 40 120 112 180 70 S290 30 410 58" />
                  <path d="M10 130 C90 120 150 80 220 94 S310 116 410 84" />
                </svg>
              </div>
              <div className={styles.fakeTable}>
                <span /><span /><span /><span />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.page}>
        <SectionLabel number="07" title="Бодит цагийн RPM telemetry" />
        <div className={styles.telemetryLayout}>
          <div className={styles.telemetryGraph}>
            <div className={styles.graphHeader}>
              <strong>Тоног төхөөрөмжийн RPM</strong>
              <span>5 сек тутам шинэчлэнэ</span>
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
          </div>
          <div className={styles.telemetryCards}>
            <MiniCard title="Юу хэмждэг вэ?" body="RPM, ачааллын хувь, температур, даралт, vibration, төлөв." />
            <MiniCard title="Яаж шинэчилдэг вэ?" body="SWR нь API-г тогтмол дуудаж dashboard state-г шинэчилдэг." />
            <MiniCard title="Яагаад хэрэгтэй вэ?" body="Хэт ачаалал, warning, critical төлөвийг эрт харуулна." />
          </div>
        </div>
      </section>

      <section className={styles.page}>
        <SectionLabel number="08" title="AI туслах систем" />
        <h2>Энгийн чат биш, task хийдэг туслах</h2>
        <div className={styles.apiFlow}>
          <FlowNode title="Асуулт" body="Хэрэглэгч dashboard дээрээс асууна" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="AI шийдвэр" body="Ямар tool хэрэгтэйг сонгоно" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Эрх шалгах" body="Role, department дахин шалгана" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Prisma үйлдэл" body="Унших, нэмэх, устгах үйлдэл" />
          <div className={styles.flowPulse}>→</div>
          <FlowNode title="Хяналтын бүртгэл" body="Tool, action, success хадгална" />
        </div>
        <div className={styles.aiExamples}>
          <MiniCard title="Унших" body="Агуулахын материал, сүүлийн activity, KPI summary авах." />
          <MiniCard title="Нэмэх" body="Зөв эрхтэй бол material transaction эсвэл production log үүсгэх." />
          <MiniCard title="Устгах" body="Зөвхөн тодорхой хүсэлт өгсөн үед зөвшөөрсөн record устгах." />
        </div>
      </section>

      <section id="deployment" className={styles.page}>
        <SectionLabel number="09" title="Байршуулалтын архитектур ба туршилт" />
        <div className={styles.deployLayout}>
          <div className={styles.deployDiagram}>
            <FlowNode title="GitHub" body="main branch дээрх код" />
            <div className={styles.flowPulse}>→</div>
            <FlowNode title="Vercel" body="Next.js build ажиллуулна" />
            <div className={styles.flowPulse}>→</div>
            <FlowNode title="Aiven MySQL" body="managed өгөгдлийн сан" />
            <div className={styles.flowPulse}>→</div>
            <FlowNode title="Хэрэглэгч" body="хөтөч дээрх dashboard" />
          </div>
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
      </section>

      <section className={`${styles.page} ${styles.finalPage}`}>
        <SectionLabel number="10" title="Дүгнэлт" />
        <div className={styles.finalLayout}>
          <div>
            <h2>Бодит production хэлбэртэй систем болсон</h2>
            <p className={styles.shortText}>
              Энэ төсөл нь зөвхөн UI биш. Authentication, RBAC, API, database relation, telemetry, AI tool, deployment бүгд нэг системд холбогдсон.
            </p>
            <div className={styles.conclusionGrid}>
              <MiniCard title="Системийн үнэ цэнэ" body="Үйлдвэрийн гол мэдээллийг нэг dashboard дээр нэгтгэсэн." />
              <MiniCard title="Техникийн үнэ цэнэ" body="TypeScript, Prisma, JWT, Vercel, Aiven ашигласан." />
              <MiniCard title="Хамгаалалт" body="Role, department, validation, rate limit, audit log ашигласан." />
              <MiniCard title="Цаашид" body="Docker орчин, CI/CD тест, илүү нарийн telemetry alert нэмнэ." />
            </div>
          </div>
          <div className={styles.finalPoster}>
            <Image src="/img/Screenshot 2026-04-26 173225.png" alt="Уул уурхайн үйлдвэрлэлийн бодит орчин" fill sizes="(max-width: 900px) 100vw, 38vw" />
            <div>
              <strong>KPI Dashboard систем</strong>
              <span>Диплом хамгаалалтын танилцуулга</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

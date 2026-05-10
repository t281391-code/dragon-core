"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BranchModal, type BranchModalBranch } from "@/components/landing/BranchModal";
import Crosshair from "@/components/landing/Crosshair";
import LightRays from "@/components/landing/LightRays";
import ModelViewer from "@/components/landing/ModelViewer";
import ScrollFloat from "@/components/landing/ScrollFloat";

const branches = [
  { x: 20, y: 57, ax: "right",  ay: "above", name: "Хөшөөт", desc: "Задгай эмульсийн үйлдвэр" },
  { x: 44, y: 84, ax: "center", ay: "above", name: "Т12, T13", desc: "Задгай эмульсийн үйлдвэр\nСавалсан эмульсийн үйлдвэр" },
  { x: 40, y: 87, ax: "center", ay: "above", name: "Засагт чандмань уурхай", desc: "Тус уурхайн дэргэдэх агуулах" },
  { x: 52, y: 84, ax: "center", ay: "above", name: "T18", desc: "Эмульгаторийн үйлдвэр" },
  { x: 57, y: 32, ax: "center", ay: "below", name: "Нөөц агуулах", desc: "8500 тн нөөцтэй" },
  { x: 55, y: 47, ax: "center", ay: "above", name: "T11, T14, T15", desc: "Өдөөгч хэрэгслийн үйлдвэр" },
  { x: 57, y: 53, ax: "center", ay: "above", name: "Төмөртэй", desc: "Тус уурхайн дэргэдэх үйлдвэр" },
  { x: 61, y: 65, ax: "left",   ay: "above", name: "Жавхлант орд", desc: "Жавхлант ордны агуулах" },
  { x: 64, y: 77, ax: "left",   ay: "above", name: "Гурван тэс", desc: "Аммиак шүү" },

];

const branchBaseData = [
  {
    id: 1,
    name: "Төв нөөц агуулах",
    category: "Төв нөөц",
    capacity: "8500 тн нөөцтэй",
    image: "/img/Screenshot 2026-04-26 173225.png",
  },
  {
    id: 2,
    name: "Салбар 1",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Ando_urt-zurag-1.jpg",
  },
  {
    id: 3,
    name: "Салбар 2",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Screenshot 2026-04-26 173634.png",
  },
  {
    id: 4,
    name: "Салбар 3",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Screenshot 2026-04-26 174838.png",
  },
  {
    id: 5,
    name: "Салбар 4",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Screenshot 2026-04-26 174929.png",
  },
  {
    id: 6,
    name: "Салбар 5",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Screenshot 2026-04-26 175101.png",
  },
  {
    id: 7,
    name: "Салбар 6",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Screenshot 2026-04-26 175120.png",
  },
  {
    id: 8,
    name: "Салбар 7",
    category: "Салбар",
    capacity: "Live KPI",
    image: "/img/Screenshot 2026-04-26 175429.png",
  },
] as const;

const branchMarkers = [
  { x: 57, y: 32 },
  { x: 20, y: 57 },
  { x: 44, y: 84 },
  { x: 40, y: 87 },
  { x: 52, y: 84 },
  { x: 55, y: 47 },
  { x: 57, y: 53 },
  { x: 61, y: 65 },
] as const;

const mapMarkers = [
  { id: "marker-1", branchId: 1, x: 57.2, y: 30.7 },
  { id: "marker-2", branchId: 2, x: 20.3, y: 57.5 },
  { id: "marker-3", branchId: 3, x: 43.5, y: 84.3 },
  { id: "marker-4", branchId: 4, x: 40.5, y: 87.4 },
  { id: "marker-5", branchId: 5, x: 52.2, y: 83.4 },
  { id: "marker-6", branchId: 6, x: 55.7, y: 47.5 },
  { id: "marker-7", branchId: 7, x: 57.3, y: 53.5 },
  { id: "marker-8", branchId: 8, x: 61.4, y: 64.8 },
  { id: "marker-9", branchId: 8, x: 63.9, y: 77 },
] as const;

const branchDescriptions = [
  "Төв агуулахын үлдэгдэл, түгээлтийн хөдөлгөөн, салбаруудын ачилтын мэдээллийг нэг дэлгэц дээр нэгтгэнэ.",
  "Салбарын гол KPI, нөөцийн хөдөлгөөн, хүлээгдэж буй ажиллагааг төв самбарт бодит цагт харуулна.",
  "Талбайн гүйцэтгэл, тээвэрлэлтийн урсгал, хяналтын дохиоллыг салбарын түвшинд нэгтгэнэ.",
  "Үйлдвэрлэл болон агуулахын хөдөлгөөнийг өдөр тутмын шийдвэр гаргалтад зориулж төвлөрүүлэн үзүүлнэ.",
  "Салбарын ачилт, хэрэглээ, гүйцэтгэлийн төлөвийг төв KPI системтэй уялдуулан харуулна.",
  "Үйл ажиллагааны статус, талбайн хуваарь, дотоод хөдөлгөөний мэдээллийг нэг цэгээс удирдана.",
  "Уурхайн орчим дахь хангамж, KPI төлөв, шуурхай ажиллагааны мэдээллийг нэгдсэн байдлаар үзүүлнэ.",
  "Салбарын нөөц, хүргэлт, талбайн гүйцэтгэлийн үзүүлэлтүүдийг бодит цагийн хяналттай харуулна.",
] as const;

const branchBullets = [
  [
    "Нөөцийн үлдэгдэл болон орлогын урсгалыг төвлөрсөн байдлаар хянана.",
    "Салбарууд руу гарах түгээлтийг KPI самбартай уялдуулж харуулна.",
    "24/7 хяналтын төлөвөөр агуулахын аюулгүй ажиллагааг ажиглана.",
  ],
  [
    "Салбарын KPI төлөвийг зураглал дээрээс шууд нээж үзнэ.",
    "Өдөр тутмын ачилт, үлдэгдэл, статусын өөрчлөлтүүдийг нэгтгэнэ.",
    "Төв хяналтын самбартай холбогдсон салбарын цэг.",
  ],
  [
    "Тээвэрлэлтийн болон талбайн гүйцэтгэлийн мэдээллийг нэг дор үзүүлнэ.",
    "Салбарын нөөц, ашиглалтын горимыг төвөөс хянах боломжтой.",
    "Шуурхай хяналтын дохиолол нэг цонхонд харагдана.",
  ],
  [
    "Үйлдвэрлэлтэй холбоотой өдөр тутмын урсгалыг dashboard-д нэгтгэнэ.",
    "Талбайн ажиллагааны төлөв болон хүлээгдэж буй ачилтыг харуулна.",
    "Салбарын KPI мониторингийг богино хугацаанд нээж шалгана.",
  ],
  [
    "Салбарын хэрэглээ, нөөц, гүйцэтгэлийг төв самбартай синк хийнэ.",
    "Төлөв өөрчлөгдөх үед хурдан нээж харах branch detail modal.",
    "Map дээрээс шууд удирдах боломжтой хяналтын цэг.",
  ],
  [
    "Ажиллагааны статус, маршрут, дотоод урсгалыг нэг картаар харуулна.",
    "Live KPI дохиолол болон гүйцэтгэлийн мэдээлэл салбар дээр төвлөрнө.",
    "Салбарын төлөвийг map marker-ээс click хийж шууд нээнэ.",
  ],
  [
    "Талбайн ойролцоох хангамж, агуулах, KPI төлөвийг шууд үзүүлнэ.",
    "Realtime хяналттай цэг тул төвөөс аюулгүй ажиллагааг ажиглахад ашиглана.",
    "Салбарын branch card дотор үндсэн статус, тайлбар, цэгцтэй мэдээлэл гарна.",
  ],
  [
    "Нөөц, хүргэлт, гүйцэтгэлийн төлөвийг нэгтгэсэн салбарын view.",
    "Map marker дээрээс зөвхөн click хийхэд дэлгэрэнгүй modal нээгдэнэ.",
    "Төв KPI системтэй холбогдсон салбарын бодит цагийн хяналт.",
  ],
] as const;

const modalBranches: Array<BranchModalBranch & { x: number; y: number }> = branchBaseData.map((branch, index) => ({
  ...branch,
  ...branchMarkers[index],
  description: branchDescriptions[index],
  stats: [
    { label: "Ангилал", value: branch.category },
    { label: "Багтаамж", value: branch.capacity },
    { label: "Төлөв", value: branch.id === 1 ? "Төв цэг" : "Идэвхтэй" },
  ],
  bullets: [...branchBullets[index]],
}));

const heroSlides = [
  { img: "/img/last11.png", lines: ["EXPLOSIVE KPI -", "VALUE CREATING", "FORCE."] },
  { img: "/img/last2.png",  lines: ["PRECISION BLAST -", "MAXIMUM", "PERFORMANCE."] },
  { img: "/img/work.jpg",   lines: ["SAFETY FIRST -", "MINE SMART,", "MINE SAFE."] },
];

const snapshotStats = [
  { value: "09", label: "Салбар цэг", detail: "Сүлжээнд холбогдсон идэвхтэй салбар, агуулах, үйлдвэрлэлийн цэгүүд" },
  { value: "8500т", label: "Нөөцийн багтаамж", detail: "Төв нөөц, агуулах, үйлдвэрлэлийн хүчин чадлыг KPI-ээр хянах боломж" },
  { value: "24/7", label: "Хяналтын горим", detail: "Үйл ажиллагаа, хөдөлгөөн, статусын мэдээлэл тасралтгүй шинэчлэгдэнэ" },
  { value: "100%", label: "Хамрах хүрээ", detail: "Салбар, уурхайн орчмын дэмжлэг, түгээлтийн мэдээлэл нэг сүлжээнд" },
] as const;

const snapshotFlow = [
  {
    title: "Хяналтын самбар",
    body: "KPI Dashboard нь аюулгүй ажиллагаа, үйлдвэрлэл, логистикийн гол үзүүлэлтүүдийг нэг дэлгэц дээр нэгтгэнэ.",
  },
  {
    title: "Салбарын урсгал",
    body: "Салбарын нөөц, уурхайн захиалга, тэсрэх материалын хөдөлгөөнийг нэг шугамаар хянах боломжтой.",
  },
  {
    title: "Гүйцэтгэлийн хяналт",
    body: "Талбай дээрх бэлэн байдал, хүргэлт, ашиглалтын мэдээлэл бодит цагт шинэчлэгдэж шийдвэр гаргалтыг дэмжинэ.",
  },
] as const;

const snapshotTags = [
  "Салбарын хяналт",
  "Нөөцийн төлөв",
  "Уурхайн захиалга",
  "Бодит цагийн хяналт",
  "Аюулгүй ажиллагаа",
  "Түгээлтийн урсгал",
] as const;

const runImages = [
  "/run/graph-1.jpg",
  "/run/graph-2.webp",
  "/run/grap-3.jpg",
  "/run/grap-4.jpg",
  "/run/grap-5.jpg",
  "/run/grap-6.jpg",
];
const bookMessages = [
  {
    title: "Explosive KPI System",
    subtitle: "Safety - Production - Control",
    body: "Smart explosive management platform",
  },
  {
    title: "Real-Time Monitoring",
    subtitle: "Precision - Safety - Performance",
    body: "Real-time monitoring for mining operations",
  },
];

const mnHeroSlides = [
  { img: "/img/last11.png", lines: ["ТЭСЭЛГЭЭНИЙ KPI", "ҮНЭ ЦЭН БҮТЭЭХ", "ХЯНАЛТ."] },
  { img: "/img/last2.png", lines: ["НАРИЙВЧИЛСАН", "ГҮЙЦЭТГЭЛИЙН", "УДИРДЛАГА."] },
  { img: "/img/work.jpg", lines: ["АЮУЛГҮЙ АЖИЛЛАГАА", "УХААЛАГ ХЯНАЛТ,", "ШУУРХАЙ ШИЙДЭЛ."] },
] as const;

const mnSnapshotStats = [
  { value: "09", label: "Салбар сүлжээ", detail: "Улс даяарх салбар, агуулах, үйлдвэрийг нэгтгэсэн." },
  { value: "8500т", label: "Төв нөөцийн хүчин чадал", detail: "Нөөц, түгээлт, багтаамжийг KPI-ээр хянана." },
  { value: "24/7", label: "Шуурхай хяналтын горим", detail: "Статус, тээвэр, үйл ажиллагаа тасралтгүй шинэчлэгдэнэ" },
  { value: "100%", label: "Нэгдсэн хамрах хүрээ", detail: "Захиалга, талбай, дэмжлэгийг нэг урсгалаар харна." },
] as const;

const mnSnapshotFlow = [
  {
    title: "Шууд хяналтын самбар",
    body: "Аюулгүй ажиллагаа, үйлдвэрлэл, логистикийн үндсэн үзүүлэлтүүдийг нэг дэлгэцэд төвлөрүүлнэ.",
  },
  {
    title: "Нөөц ба түгээлтийн урсгал",
    body: "Салбарын нөөц, уурхайн захиалга, тэсрэх материалын хөдөлгөөнийг нэг логикоор холбоно.",
  },
  {
    title: "Талбайн гүйцэтгэлийн дохио",
    body: "Бэлэн байдал, хүргэлт, ашиглалтын мэдээлэл бодит цагт шинэчлэгдэнэ.",
  },
] as const;

const mnSnapshotTags = [
  "Салбарын төв хяналт",
  "Нөөцийн шуурхай төлөв",
  "Уурхайн захиалгын урсгал",
  "Бодит цагийн дохиолол",
  "Аюулгүй ажиллагааны хяналт",
  "Түгээлтийн гүйцэтгэл",
] as const;

const mnBookMessages = [
  {
    title: "Тэсрэх бодисын KPI экосистем",
    subtitle: "Аюулгүй байдал - Үйлдвэрлэл - Удирдлага",
    body: "Уурхайн ажиллагааны урсгал, нөөц, талбайн шийдвэр гаргалтыг нэгтгэсэн ухаалаг платформ",
  },
  {
    title: "Бодит цагийн удирдлагын самбар",
    subtitle: "Нарийвчлал - Шуурхай байдал - Гүйцэтгэл",
    body: "Уул уурхайн салбар бүрийн хөдөлгөөн, төлөв, гүйцэтгэлийг нэг харагдацад төвлөрүүлнэ",
  },
] as const;

const mnBranches: Array<BranchModalBranch & { x: number; y: number }> = [
  {
    id: 1,
    x: 57,
    y: 32,
    name: "Төв нөөц агуулах",
    category: "Төв нөөц",
    capacity: "8500 тн нөөцтэй",
    image: branchBaseData[0].image,
    description: "Төв агуулахын үлдэгдэл, түгээлтийн хөдөлгөөн, салбаруудын ачилтын мэдээллийг нэг дэлгэц дээр нэгтгэнэ.",
    stats: [
      { label: "Ангилал", value: "Төв нөөц" },
      { label: "Багтаамж", value: "8500 тн" },
      { label: "Төлөв", value: "Төв цэг" },
    ],
    bullets: [
      "Нөөцийн үлдэгдэл болон орлогын урсгалыг төвлөрсөн байдлаар хянана.",
      "Салбарууд руу гарах түгээлтийг KPI самбартай уялдуулж харуулна.",
      "24/7 хяналтын төлөвөөр агуулахын аюулгүй ажиллагааг ажиглана.",
    ],
  },
  {
    id: 2,
    x: 20,
    y: 57,
    name: "Салбар 1",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[1].image,
    description: "Салбарын гол KPI, нөөцийн хөдөлгөөн, хүлээгдэж буй ажиллагааг төв самбарт бодит цагт харуулна.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Салбарын KPI төлөвийг зураглал дээрээс шууд нээж үзнэ.",
      "Өдөр тутмын ачилт, үлдэгдэл, статусын өөрчлөлтүүдийг нэгтгэнэ.",
      "Төв хяналтын самбартай холбогдсон салбарын цэг.",
    ],
  },
  {
    id: 3,
    x: 44,
    y: 84,
    name: "Салбар 2",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[2].image,
    description: "Талбайн гүйцэтгэл, тээвэрлэлтийн урсгал, хяналтын дохиоллыг салбарын түвшинд нэгтгэнэ.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Тээвэрлэлтийн болон талбайн гүйцэтгэлийн мэдээллийг нэг дор үзүүлнэ.",
      "Салбарын нөөц, ашиглалтын горимыг төвөөс хянах боломжтой.",
      "Шуурхай хяналтын дохиолол нэг цонхонд харагдана.",
    ],
  },
  {
    id: 4,
    x: 40,
    y: 87,
    name: "Салбар 3",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[3].image,
    description: "Үйлдвэрлэл болон агуулахын хөдөлгөөнийг өдөр тутмын шийдвэр гаргалтад зориулж төвлөрүүлэн үзүүлнэ.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Үйлдвэрлэлтэй холбоотой өдөр тутмын урсгалыг нэгтгэнэ.",
      "Талбайн ажиллагааны төлөв болон хүлээгдэж буй ачилтыг харуулна.",
      "Салбарын KPI мониторингийг богино хугацаанд нээж шалгана.",
    ],
  },
  {
    id: 5,
    x: 52,
    y: 84,
    name: "Салбар 4",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[4].image,
    description: "Салбарын ачилт, хэрэглээ, гүйцэтгэлийн төлөвийг төв KPI системтэй уялдуулан харуулна.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Салбарын хэрэглээ, нөөц, гүйцэтгэлийг төв самбартай уялдуулна.",
      "Төлөв өөрчлөгдөх үед хурдан нээж харах дэлгэрэнгүй цонх.",
      "Зураглал дээрээс шууд удирдах боломжтой хяналтын цэг.",
    ],
  },
  {
    id: 6,
    x: 55,
    y: 47,
    name: "Салбар 5",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[5].image,
    description: "Үйл ажиллагааны статус, талбайн хуваарь, дотоод хөдөлгөөний мэдээллийг нэг цэгээс удирдана.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Ажиллагааны статус, маршрут, дотоод урсгалыг нэг картаар харуулна.",
      "Шууд KPI дохиолол болон гүйцэтгэлийн мэдээлэл төвлөрнө.",
      "Салбарын төлөвийг тэмдэглэгээн дээр дарж шууд нээнэ.",
    ],
  },
  {
    id: 7,
    x: 57,
    y: 53,
    name: "Салбар 6",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[6].image,
    description: "Уурхайн орчим дахь хангамж, KPI төлөв, шуурхай ажиллагааны мэдээллийг нэгдсэн байдлаар үзүүлнэ.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Талбайн ойролцоох хангамж, агуулах, KPI төлөвийг шууд үзүүлнэ.",
      "Төвөөс аюулгүй ажиллагааг ажиглахад ашиглана.",
      "Үндсэн статус, тайлбар, цэгцтэй мэдээлэл гарна.",
    ],
  },
  {
    id: 8,
    x: 61,
    y: 65,
    name: "Салбар 7",
    category: "Салбар",
    capacity: "Шууд KPI",
    image: branchBaseData[7].image,
    description: "Салбарын нөөц, хүргэлт, талбайн гүйцэтгэлийн үзүүлэлтүүдийг бодит цагийн хяналттай харуулна.",
    stats: [
      { label: "Ангилал", value: "Салбар" },
      { label: "Багтаамж", value: "Шууд KPI" },
      { label: "Төлөв", value: "Идэвхтэй" },
    ],
    bullets: [
      "Нөөц, хүргэлт, гүйцэтгэлийн төлөвийг нэгтгэсэн салбарын харагдац.",
      "Тэмдэглэгээн дээрээс зөвхөн дархад дэлгэрэнгүй цонх нээгдэнэ.",
      "Төв KPI системтэй холбогдсон бодит цагийн хяналт.",
    ],
  },
] as const;

export default function Home() {
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [bookMessageIndex, setBookMessageIndex] = useState(0);
  const [isDashboardPreviewOpen, setIsDashboardPreviewOpen] = useState(false);
  const [activeBranch, setActiveBranch] = useState<BranchModalBranch | null>(null);
  const [isBranchCardVisible, setIsBranchCardVisible] = useState(false);
  const [supportsHoverCard, setSupportsHoverCard] = useState(false);
  const snapshotSectionRef = useRef<HTMLElement | null>(null);
  const branchesMapRef = useRef<HTMLDivElement | null>(null);
  const branchCloseTimeoutRef = useRef<number | null>(null);
  const branchUnmountTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const heroId = window.setInterval(() => {
      setHeroSlideIndex((i) => (i + 1) % mnHeroSlides.length);
    }, 4000);
    return () => window.clearInterval(heroId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setBookMessageIndex((current) => (current + 1) % mnBookMessages.length);
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverCapability = () => {
      setSupportsHoverCard(mediaQuery.matches);
    };

    updateHoverCapability();
    mediaQuery.addEventListener("change", updateHoverCapability);

    return () => {
      mediaQuery.removeEventListener("change", updateHoverCapability);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (branchCloseTimeoutRef.current !== null) {
        window.clearTimeout(branchCloseTimeoutRef.current);
      }

      if (branchUnmountTimeoutRef.current !== null) {
        window.clearTimeout(branchUnmountTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeBranch && !isDashboardPreviewOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeBranch) {
          setIsBranchCardVisible(false);
          branchUnmountTimeoutRef.current = window.setTimeout(() => {
            setActiveBranch((current) => (current?.id === activeBranch.id ? null : current));
          }, 220);
          return;
        }

        if (isDashboardPreviewOpen) {
          setIsDashboardPreviewOpen(false);
        }
      }
    };

    if (isDashboardPreviewOpen) {
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeBranch, isDashboardPreviewOpen]);

  const clearBranchCloseTimeout = () => {
    if (branchCloseTimeoutRef.current !== null) {
      window.clearTimeout(branchCloseTimeoutRef.current);
      branchCloseTimeoutRef.current = null;
    }
  };

  const clearBranchUnmountTimeout = () => {
    if (branchUnmountTimeoutRef.current !== null) {
      window.clearTimeout(branchUnmountTimeoutRef.current);
      branchUnmountTimeoutRef.current = null;
    }
  };

  const openBranchCard = (branch: BranchModalBranch) => {
    clearBranchCloseTimeout();
    clearBranchUnmountTimeout();
    setActiveBranch(branch);
    setIsBranchCardVisible(true);
  };

  const closeBranchCard = (branchId?: number) => {
    clearBranchCloseTimeout();
    clearBranchUnmountTimeout();
    setIsBranchCardVisible(false);

    const targetBranchId = branchId ?? activeBranch?.id;
    if (!targetBranchId) return;

    branchUnmountTimeoutRef.current = window.setTimeout(() => {
      setActiveBranch((current) => (current?.id === targetBranchId ? null : current));
    }, 220);
  };

  const scheduleBranchClose = (branchId?: number) => {
    if (!supportsHoverCard) return;

    clearBranchCloseTimeout();
    branchCloseTimeoutRef.current = window.setTimeout(() => {
      closeBranchCard(branchId);
    }, 110);
  };

  const handleMarkerClick = (branch: BranchModalBranch) => {
    if (supportsHoverCard) return;

    if (activeBranch?.id === branch.id && isBranchCardVisible) {
      closeBranchCard(branch.id);
      return;
    }

    openBranchCard(branch);
  };

  return (
    <main className="landing-page">
      <section className="hero-card">
        <div className="hero-bg" aria-hidden="true">
          {mnHeroSlides.map((s, i) => (
            <div key={i} className={`hero-bg__slide${heroSlideIndex === i ? " hero-bg__slide--active" : ""}`}>
              <Image src={s.img} alt="" fill style={{ objectFit: "cover", objectPosition: "78% center" }} />
            </div>
          ))}
          <div className="hero-bg__overlay" />
        </div>

        <div className="hero-card__glow hero-card__glow--left" />
        <div className="hero-card__glow hero-card__glow--right" />

        <header className="landing-topbar">
          <Link className="brand" href="/" aria-label="Explo V2 KPI нүүр">
            <span className="brand__line">
              <span className="brand__explo">EXPLO</span><span className="brand__v2">V2</span>
            </span>
            <span className="brand__kpi">KPI</span>
          </Link>

          <Link className="login-button" href="/login">
            <span>НЭВТРЭХ</span>
            <span className="login-button__arrow" aria-hidden="true">&#8594;</span>
          </Link>
        </header>

        <div className="hero-content">
          <div className="hero-copy">
            <h1 key={heroSlideIndex}>
              {mnHeroSlides[heroSlideIndex].lines.map((line, i) => (
                <span key={i} className={i < mnHeroSlides[heroSlideIndex].lines.length - 1 ? "hero-copy__line--nowrap" : ""}>{line}</span>
              ))}
            </h1>

            <p className="hero-subtitle">Өгөгдөл суурилсан шийдвэр, үр дүнтэй удирдлага</p>

            <div className="cta-row">
              <a className="cta-link" href="/dashboard">KPI самбар</a>
              <a className="cta-button" href="/dashboard" aria-label="KPI самбар руу орох">
                <span aria-hidden="true">&#8594;</span>
              </a>
            </div>
          </div>
        </div>

        <nav className="feature-nav" aria-label="Үндсэн цэс">
          <a className="feature-tile" href="/dashboard">
            <span className="feature-tile__icon feature-tile__icon--dashboard" />
            <span>ХЯНАЛТЫН САМБАР</span>
          </a>
          <a className="feature-tile feature-tile--swap" href="#">
            <span className="feature-tile__default">
              <span className="feature-tile__icon feature-tile__icon--products" />
              <span>БҮТЭЭГДЭХҮҮН</span>
            </span>
            <span className="feature-tile__swapped">
              <Image src="/img/last.png" alt="" width={44} height={44} className="feature-tile__swap-img" />
              <span>Уул уурхайд ашиглагдах тэсрэх материалын мэдээллийг гар утаснаас хянах боломжтой.</span>
            </span>
          </a>
          <a className="feature-tile feature-tile--swap" href="#">
            <span className="feature-tile__default">
              <span className="feature-tile__icon feature-tile__icon--events" />
              <span>ҮЙЛ ЯВДАЛ</span>
            </span>
            <span className="feature-tile__swapped">
              <Image src="/img/bomb.jpg" alt="" width={44} height={44} className="feature-tile__swap-img" />
              <span>Итгэлцэл үр дүн дээр үйл ажиллагаа явуулна.</span>
            </span>
          </a>
        </nav>
      </section>

      <div className="content-surface">
        <section ref={snapshotSectionRef} className="snapshot-bridge" aria-labelledby="snapshot-title">
          <LightRays
            className="snapshot-bridge__light-rays"
            raysOrigin="top-center"
            raysColor="#8fdcff"
            raysSpeed={0.62}
            lightSpread={0.92}
            rayLength={1.65}
            pulsating
            fadeDistance={1.24}
            saturation={1}
            followMouse
            mouseInfluence={0.06}
            noiseAmount={0.035}
            distortion={0.075}
          />
          <div className="snapshot-bridge__intro">
            <p className="snapshot-bridge__eyebrow">
              <ScrollFloat
                triggerRef={snapshotSectionRef}
                animationDuration={0.9}
                ease="power3.out"
                scrollStart="top bottom-=6%"
                scrollEnd="center center+=12%"
                stagger={0.012}
              >
                KPI САМБАР
              </ScrollFloat>
            </p>
            <div>
              <h2 id="snapshot-title">
                <ScrollFloat
                  triggerRef={snapshotSectionRef}
                  animationDuration={1.05}
                  ease="back.out(1.7)"
                  scrollStart="top bottom-=6%"
                  scrollEnd="center center+=12%"
                  stagger={0.018}
                >
                  {"KPI самбараас салбар, нөөц, хяналтын\nбүх мэдээллийг нэг дор удирдана."}
                </ScrollFloat>
              </h2>
              <p>
                <ScrollFloat
                  triggerRef={snapshotSectionRef}
                  animationDuration={0.86}
                  ease="power2.out"
                  scrollStart="top bottom-=6%"
                  scrollEnd="center center+=12%"
                  stagger={0.004}
                >
                  Энэ хэсэг нь салбаруудын хамрах хүрээ, нөөцийн чадавх, 24/7 хяналт болон талбайн гүйцэтгэлийн мэдээллийг мар хэсэг рүү орохоос өмнө нэг урсгалаар харуулж байна.
                </ScrollFloat>
              </p>
            </div>
          </div>

          <div className="snapshot-bridge__grid">
            {mnSnapshotStats.map((stat) => (
              <article key={stat.label} className="snapshot-card">
                <strong className="snapshot-card__value">
                  <ScrollFloat
                    triggerRef={snapshotSectionRef}
                    animationDuration={0.74}
                    ease="power3.out"
                    scrollStart="top bottom-=6%"
                    scrollEnd="center center+=12%"
                    stagger={0.018}
                  >
                    {stat.value}
                  </ScrollFloat>
                </strong>
                <h3 className="snapshot-card__label">
                  <ScrollFloat
                    triggerRef={snapshotSectionRef}
                    animationDuration={0.82}
                    ease="power3.out"
                    scrollStart="top bottom-=6%"
                    scrollEnd="center center+=12%"
                    stagger={0.01}
                  >
                    {stat.label}
                  </ScrollFloat>
                </h3>
                <p className="snapshot-card__detail">
                  <ScrollFloat
                    triggerRef={snapshotSectionRef}
                    animationDuration={0.72}
                    ease="power2.out"
                    scrollStart="top bottom-=6%"
                    scrollEnd="center center+=12%"
                    stagger={0.003}
                  >
                    {stat.detail}
                  </ScrollFloat>
                </p>
              </article>
            ))}
          </div>

          <div className="snapshot-bridge__detail">
            <div className="snapshot-bridge__flow">
              {mnSnapshotFlow.map((item, index) => (
                <article key={item.title} className="flow-card">
                  <span className="flow-card__index">
                    <ScrollFloat
                      triggerRef={snapshotSectionRef}
                      animationDuration={0.7}
                      ease="power3.out"
                      scrollStart="top bottom-=6%"
                      scrollEnd="center center+=12%"
                      stagger={0.018}
                    >
                      {`0${index + 1}`}
                    </ScrollFloat>
                  </span>
                  <h3 className="flow-card__title">
                    <ScrollFloat
                      triggerRef={snapshotSectionRef}
                      animationDuration={0.8}
                      ease="power3.out"
                      scrollStart="top bottom-=6%"
                      scrollEnd="center center+=12%"
                      stagger={0.009}
                    >
                      {item.title}
                    </ScrollFloat>
                  </h3>
                  <p className="flow-card__body">
                    <ScrollFloat
                      triggerRef={snapshotSectionRef}
                      animationDuration={0.7}
                      ease="power2.out"
                      scrollStart="top bottom-=6%"
                      scrollEnd="center center+=12%"
                      stagger={0.003}
                    >
                      {item.body}
                    </ScrollFloat>
                  </p>
                </article>
              ))}
            </div>

            <div className="snapshot-bridge__tags" aria-label="Сүлжээний боломжууд">
              {mnSnapshotTags.map((tag) => (
                <span key={tag} className="snapshot-tag">
                  <ScrollFloat
                    triggerRef={snapshotSectionRef}
                    animationDuration={0.66}
                    ease="power2.out"
                    scrollStart="top bottom-=6%"
                    scrollEnd="center center+=12%"
                    stagger={0.007}
                  >
                    {tag}
                  </ScrollFloat>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="branches-section" aria-labelledby="branches-title">
          <div className="branches-section__header">
            <h2 id="branches-title">Map of branches</h2>
            <a href="#" className="branches-section__link"></a>
          </div>

          <div ref={branchesMapRef} className="branches-section__map-wrap">
            <Image
              src="/img/branches-map-reference.png"
              alt="Салбаруудын зураглал"
              width={1783}
              height={768}
              quality={100}
              className="branches-section__map-image"
            />
            <div className="map-dots">
              {mapMarkers.map((marker) => {
                const branch = mnBranches.find((item) => item.id === marker.branchId);
                if (!branch) return null;
                return (
                  <button
                    key={marker.id}
                    type="button"
                    className={`map-dot${activeBranch?.id === branch.id ? " map-dot--selected" : ""}`}
                    style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                    aria-label={`${branch.name} дэлгэрэнгүй`}
                    aria-expanded={activeBranch?.id === branch.id && isBranchCardVisible}
                    onMouseEnter={() => {
                      if (!supportsHoverCard) return;
                      openBranchCard(branch);
                    }}
                    onMouseLeave={() => {
                      if (!supportsHoverCard) return;
                      scheduleBranchClose(branch.id);
                    }}
                    onClick={() => handleMarkerClick(branch)}
                  />
                );
              })}
            </div>
            <BranchModal
              branch={activeBranch}
              isVisible={isBranchCardVisible}
              isTouchFallback={!supportsHoverCard}
              onClose={() => closeBranchCard()}
              onMouseEnter={() => clearBranchCloseTimeout()}
              onMouseLeave={() => scheduleBranchClose(activeBranch?.id)}
            />
            <Crosshair color="rgba(0, 212, 255, 0.55)" containerRef={branchesMapRef} />
          </div>
        </section>

        <section className="feature-grid-section" aria-label="Системийн боломжууд">
          <div className="feature-grid">
            <div className="feature-grid-card feature-grid-card--chart">
              <span className="feature-grid-card__icon" aria-hidden="true" />
              <span className="feature-grid-card__text">
                <span className="feature-grid-card__label">Салбарын гүйцэтгэл</span>
                <span className="feature-grid-card__sub">Статистик</span>
              </span>
            </div>
            <div className="feature-grid-card feature-grid-card--growth">
              <span className="feature-grid-card__icon" aria-hidden="true" />
              <span className="feature-grid-card__text">
                <span className="feature-grid-card__label">Борлуулалтын тоон мэдээ</span>
                <span className="feature-grid-card__sub">Өсөлт, бууралт</span>
              </span>
            </div>
            <div className="feature-grid-card feature-grid-card--users">
              <span className="feature-grid-card__icon" aria-hidden="true" />
              <span className="feature-grid-card__text">
                <span className="feature-grid-card__label">Хэрэглэгчийн идэвх</span>
                <span className="feature-grid-card__sub">Хэрэглэгч</span>
              </span>
            </div>
            <div className="feature-grid-card feature-grid-card--report">
              <span className="feature-grid-card__icon" aria-hidden="true" />
              <span className="feature-grid-card__text">
                <span className="feature-grid-card__label">Тайлан, анализ</span>
                <span className="feature-grid-card__sub">Тойм тайлан</span>
              </span>
            </div>
          </div>
        </section>

        <section className="run-marquee-section" aria-label="Салбарын зургийн хэсэг">
          <div className="run-marquee-section__fade run-marquee-section__fade--left" aria-hidden="true" />
          <div className="run-marquee-section__fade run-marquee-section__fade--right" aria-hidden="true" />

          <div className="run-marquee">
            <div className="run-marquee__track">
              {[...runImages, ...runImages].map((src, index) => (
                <article key={`${src}-${index}`} className="run-marquee__card">
                  <Image
                    src={src}
                    alt="Салбарын зураг"
                    width={960}
                    height={540}
                    quality={100}
                    className="run-marquee__image"
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-viewer-section" aria-labelledby="dashboard-viewer-title">
          <div className="dashboard-viewer-section__copy">
            <p className="dashboard-viewer-section__eyebrow">3D VIEWER</p>
            
          </div>

          <div
            className="dashboard-viewer-section__card"
            style={{
              background: "linear-gradient(to bottom, #020d1e 0%, #0a1628 8%, #040b14 50%, #0a1628 92%, #020d1e 100%)",
              marginTop: "-2px",
              marginBottom: "-2px",
            }}
          >
            <div className="dashboard-viewer-section__canvas">
              <ModelViewer
                url="/models/source/11.glb"
                width="100%"
                height="100%"
                defaultRotationX={0}
                defaultRotationY={15}
                defaultZoom={1.5}
                modelYOffset={0.25}
                minZoomDistance={0.1}
                maxZoomDistance={20}
                enableMouseParallax
                enableManualRotation
                enableHoverRotation
                enableManualZoom={false}
                ambientIntensity={0.6}
                keyLightIntensity={2.2}
                fillLightIntensity={0.58}
                rimLightIntensity={2.8}
                environmentPreset="studio"
                autoFrame
                fadeIn={false}
                autoRotate
                autoRotateSpeed={0.12}
              />
            </div>
          </div>
        </section>

        <section className="value-banner" aria-label="KPI самбар">
          <div className="value-banner__inner">
            <h2>KPI Dashboard</h2>
            <button
              type="button"
              className="value-banner__brand value-banner__brand-button"
              aria-label="KPI dashboard preview нээх"
              aria-haspopup="dialog"
              aria-controls="dashboard-preview-title"
              onClick={() => setIsDashboardPreviewOpen(true)}
            >
              <span className="value-banner__brand-name">KPI</span>
              <span className="value-banner__brand-tag">EXPLOSIVES</span>
            </button>
          </div>
        </section>

        <section className="book-section" aria-labelledby="book-section-title">
          <div className="book-section__header">
            <h2 id="book-section-title">KPI BOOK</h2>
          </div>

          <div className="book-showcase">
            <article className="book-card">
              <div className="book-card__shadow" aria-hidden="true" />
              <div className="book-card__book">
                <div className="book-card__cover">
                  <div className="book-card__cover-logo-wrap">
                    <Image
                      src="/logo/mining.png"
                      alt="Уул уурхайн лого"
                      width={240}
                      height={240}
                      quality={100}
                      className="book-card__cover-logo"
                    />
                  </div>
                  <span className="book-card__cover-badge">KPI</span>
                </div>
                <div className="book-card__pages">
                  <div className="book-card__pages-copy">
                    <h3>KPI самбар</h3>
                    <p>Манай KPI Dashboard нь 100% дотоодын хөрөнгө оруулалттай. Уул уурхайн тэсрэх бодисын салбарын хөдөлмөрийн аюулгүй байдал болон өдөр тутмын үйл ажиллагааг дэлхийн стандартад нийцүүлэн хянахын зэрэгцээ хэлтэс хоорондын уялдаа, уламжлалт ажиллагааны үр ашгийг сайжруулж, дэвшилтэт удирдлагын тогтолцоонд шилжүүлэх систем юм.</p>
                    <p hidden>
                     Манай KPI Dashboard нь 100% дотоодын хөрөнгө оруулалттай. Уул уурхайн тэсрэх бодисын салбарын хөдөлмөрийн аюулгүй байдал болон өдөр тутмын үйл ажиллагааг дэлхийн стандартад нийцүүлэн хянахын зэрэгцээ хэлтэс хоорондын уялдаа, уламжлалт ажиллагааны үр ашгийг сайжруулж, дэвшилтэт удирдлагын тогтолцоонд шилжүүлэх систем юм.
                    </p>
                  </div>
                </div>
              </div>
              <div className="book-card__sidecopy" aria-live="polite">
                {mnBookMessages.map((message, index) => (
                  <div
                    key={message.title}
                    className={`book-card__message ${index === bookMessageIndex ? "book-card__message--active" : ""}`}
                  >
                    <h3>{message.title}</h3>
                    <p className="book-card__message-subtitle">{message.subtitle}</p>
                    <p className="book-card__message-body">{message.body}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      <footer className="site-footer">
        <div className="site-footer__glow site-footer__glow--left" aria-hidden="true" />
        <div className="site-footer__glow site-footer__glow--right" aria-hidden="true" />

        <div className="site-footer__inner">
          <div className="footer-main">
            {/* Brand column */}
            <div className="footer-brand">
              <a className="footer-brand__logo" href="#" aria-label="Explo V2 KPI">
                <span className="footer-brand__line">
                  <span className="footer-brand__explo">EXPLO</span><span className="footer-brand__v2">V2</span>
                </span>
                <span className="footer-brand__kpi">KPI</span>
              </a>
              <p className="footer-brand__desc">
                Тэсрэх бодисын KPI удирдлагын систем
              </p>
              <ul className="footer-contacts">
                <li className="footer-contact-item">
                  <svg className="footer-contact-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                  </svg>
                  <span>СБД, 8-р хороо, Сүхбаатарын талбай 8/1, Сити Тауэр, УБ 14200</span>
                </li>
                <li className="footer-contact-item">
                  <svg className="footer-contact-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  <span>mera@mera.mn</span>
                </li>
                <li className="footer-contact-item">
                  <svg className="footer-contact-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.47.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/>
                  </svg>
                  <span>(+976) 7555-6677</span>
                </li>
              </ul>
            </div>

            {/* Nav columns */}
            <div className="footer-nav-cols">
              <div className="footer-col">
                <h3 className="footer-col__title">Холбоос</h3>
                <ul className="footer-col__list">
                  <li><a href="#">Бидний тухай</a></li>
                  <li><a href="#">Мэдээ</a></li>
                  <li><a href="#">Нийтлэг асуулт</a></li>
                  <li><a href="#">Нээлттэй ажлын байр</a></li>
                  <li><a href="#">Салбарууд</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h3 className="footer-col__title">Бүтээгдэхүүн</h3>
                <ul className="footer-col__list">
                  <li><a href="#">Эмульсийн тэсрэх бодис</a></li>
                  <li><a href="#">Энгийн тэсрэх бодис</a></li>
                  <li><a href="#">Өдөөгч тэсрэх бодис</a></li>
                  <li><a href="#">Тэсэлгээний хэрэгсэл</a></li>
                  <li><a href="#">Импортын бүтээгдэхүүн</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h3 className="footer-col__title">Үйлчилгээ</h3>
                <ul className="footer-col__list">
                  <li><a href="#">Тэсэлгээний ажил үйлчилгээ</a></li>
                  <li><a href="#">Цооног өрөмдлөгийн үйлчилгээ</a></li>
                  <li><a href="#">Цооног цэнэглэх үйлчилгээ</a></li>
                  <li><a href="#">Бусад үйлчилгээ</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span className="footer-copyright">© 2026 KPI самбар. Бүх эрх хуулиар хамгаалагдсан.</span>
            <div className="footer-socials">
              <a href="#" className="footer-social-link" aria-label="Фэйсбүүк">
                <svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="ЛинкэдИн">
                <svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="Инстаграм">
                <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="Икс">
                <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="Юүтүб">
                <svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {isDashboardPreviewOpen ? (
        <div
          className="dashboard-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-preview-title"
          onClick={() => setIsDashboardPreviewOpen(false)}
        >
          <div className="dashboard-preview-modal__backdrop" />

          <div className="dashboard-preview-modal__panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="dashboard-preview-modal__close"
              aria-label="KPI dashboard preview хаах"
              onClick={() => setIsDashboardPreviewOpen(false)}
            >
              &#10005;
            </button>

            <div className="dashboard-preview-modal__hero">
              <div className="dashboard-preview-modal__copy">
                <p className="dashboard-preview-modal__eyebrow">KPI PREVIEW</p>
                <h2 id="dashboard-preview-title">Удирдлагын самбарын ерөнхий харагдац</h2>
                <p className="dashboard-preview-modal__body">
                  Салбарын зураглал, нөөцийн төлөв, шуурхай дохиолол, өдөр тутмын гүйцэтгэлийг нэг урсгалаар харах
                  fullscreen preview.
                </p>

                <div className="dashboard-preview-modal__actions">
                  <Link
                    className="dashboard-preview-modal__primary"
                    href="/login"
                    onClick={() => setIsDashboardPreviewOpen(false)}
                  >
                    Нэвтрэх
                  </Link>
                  <a
                    href="#branches-title"
                    className="dashboard-preview-modal__secondary"
                    onClick={() => setIsDashboardPreviewOpen(false)}
                  >
                    Салбарын зураглал
                  </a>
                </div>

                <div className="dashboard-preview-modal__stats">
                  {mnSnapshotStats.map((stat) => (
                    <article key={`preview-${stat.label}`} className="dashboard-preview-modal__stat">
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="dashboard-preview-modal__visual">
                <Image
                  src="/img/mongolian.jpg"
                  alt="KPI dashboard map preview"
                  width={1783}
                  height={768}
                  className="dashboard-preview-modal__image"
                />
                <div className="dashboard-preview-modal__visual-overlay" />
              
              </div>
            </div>

            <div className="dashboard-preview-modal__grid">
            
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

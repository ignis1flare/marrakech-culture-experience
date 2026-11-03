import { db, quizQuestionsTable, quizRunsTable, slidesTable } from "@workspace/db";
import { count, eq, inArray } from "drizzle-orm";

const slideSeeds = [
  {
    id: "welcome",
    title: "Welcome to Marrakech",
    subtitle: "A journey through the Red City",
    content: "A city shaped by exchange, craft, learning, and daily life.",
    presenterNotes: "Open by placing Marrakech in western Morocco, near the foothills of the High Atlas. Explain that this is a cultural journey rather than a checklist of attractions.",
    orderIndex: 0,
  },
  {
    id: "identity",
    title: "What is Marrakech known for?",
    subtitle: "Many stories in one city",
    content: "The medina, ochre walls, gardens, souks, architecture, food, music, and hospitality.",
    presenterNotes: "Invite the audience to name something they already associate with Marrakech. Distinguish the city's living culture from tourist imagery.",
    orderIndex: 1,
  },
  {
    id: "history",
    title: "A brief history",
    subtitle: "Founded by the Almoravids",
    content: "Established around 1070–1071, Marrakech became a major political and cultural center under successive Moroccan dynasties.",
    presenterNotes: "The founding date is commonly given as 1070 or 1071. Later Almohad, Saadian, and Alaouite periods each left visible marks on the city.",
    orderIndex: 2,
  },
  {
    id: "architecture",
    title: "The red architecture",
    subtitle: "Landmarks and living spaces",
    content: "From the Koutoubia's minaret to riad courtyards, architecture connects public life, faith, climate, and craft.",
    presenterNotes: "The Koutoubia minaret is an Almohad landmark. Bahia Palace and Ben Youssef Madrasa show different periods and decorative traditions.",
    orderIndex: 3,
  },
  {
    id: "medina",
    title: "Inside the medina",
    subtitle: "A city of routes and workshops",
    content: "Souks, homes, workshops, mosques, fountains, and neighborhood life form a dense historic urban fabric.",
    presenterNotes: "Explain that souks are not one single market: trades and routes connect many small places. Everyday life continues alongside visitor activity.",
    orderIndex: 4,
  },
  {
    id: "jemaa",
    title: "Jemaa el-Fnaa",
    subtitle: "A gathering place in motion",
    content: "Food, storytelling, music, and public life have made the square a defining part of the medina.",
    presenterNotes: "UNESCO recognizes the cultural space of Jemaa el-Fnaa as intangible heritage. Describe performers respectfully as cultural practitioners, not props.",
    orderIndex: 5,
  },
  {
    id: "food",
    title: "Food and tanjiya",
    subtitle: "A taste of Marrakech",
    content: "Tanjiya marrakchia, tagines, couscous, breads, spices, and mint tea carry memory and shared hospitality.",
    presenterNotes: "Tanjiya is a slow-cooked meat dish associated with Marrakech, traditionally prepared in a distinctive vessel. Recipes and practices vary.",
    orderIndex: 6,
  },
  {
    id: "hospitality",
    title: "Hospitality and traditions",
    subtitle: "Shared gestures, varied customs",
    content: "Tea, meals, family gatherings, and celebrations express care in ways that vary between households and generations.",
    presenterNotes: "Avoid presenting one custom as universal. Ramadan, Eid, weddings, clothing, and tea service can differ by family, region, and personal practice.",
    orderIndex: 7,
  },
  {
    id: "music",
    title: "Music, art, and craft",
    subtitle: "Knowledge held in the hands",
    content: "Zellige, leatherwork, carpentry, textiles, Gnawa music, and other traditions connect skill with community and history.",
    presenterNotes: "Gnawa is a diverse Moroccan musical and spiritual tradition; the sintir and qraqeb are among its recognizable instruments. Craft knowledge is learned and adapted over time.",
    orderIndex: 8,
  },
  {
    id: "heritage",
    title: "Why heritage matters",
    subtitle: "Continuity and change",
    content: "Living heritage is sustained by people who practice, teach, adapt, and care for it.",
    presenterNotes: "Emphasize that heritage is not frozen in the past. Local residents, artisans, cultural practitioners, and institutions all shape what continues.",
    orderIndex: 9,
  },
  {
    id: "interaction",
    title: "Your turn",
    subtitle: "Share a word or question",
    content: "What word comes to mind when you think of Marrakech?",
    presenterNotes: "Invite participants to submit one or two words, or send a question from their phones. Read a few submissions without identifying people unless they choose a display name.",
    orderIndex: 10,
  },
  {
    id: "quiz",
    title: "Final quiz",
    subtitle: "What did you discover?",
    content: "Join on your phone and test your knowledge of Marrakech.",
    presenterNotes: "Launch the quiz from the presenter dashboard. Answers are scored on the server; reveal explanations after each question or at the end.",
    orderIndex: 11,
  },
];

const originalQuizSeeds = [
  {
    id: "q-koutoubia",
    question: "Which mosque is one of Marrakech's best-known landmarks?",
    options: ["Koutoubia Mosque", "Hassan II Mosque", "Tin Mal Mosque", "Al Qarawiyyin Mosque"],
    correctIndex: 0,
    explanation: "The Koutoubia Mosque and its minaret are among Marrakech's most recognizable landmarks.",
    points: 100,
    category: "Architecture",
  },
  {
    id: "q-tanjiya",
    question: "What is tanjiya marrakchia?",
    options: ["A slow-cooked meat dish", "A sweet mint pastry", "A kind of woven carpet", "A musical instrument"],
    correctIndex: 0,
    explanation: "Tanjiya marrakchia is a slow-cooked meat dish associated with Marrakech.",
    points: 100,
    category: "Food",
  },
  {
    id: "q-madrasa",
    question: "What was Ben Youssef Madrasa?",
    options: ["A historic Islamic school", "A royal garden", "A city gate", "A public bath"],
    correctIndex: 0,
    explanation: "Ben Youssef Madrasa was a historic Islamic college noted for its richly decorated architecture.",
    points: 100,
    category: "Architecture",
  },
  {
    id: "q-riad",
    question: "What feature is commonly associated with a traditional riad?",
    options: ["An inward-facing courtyard", "A rooftop lighthouse", "A river-facing balcony", "A large front lawn"],
    correctIndex: 0,
    explanation: "Many traditional riads are organized around an interior courtyard or garden.",
    points: 100,
    category: "Daily life",
  },
  {
    id: "q-square",
    question: "Which Marrakech square is associated with storytellers, food stalls, and performers?",
    options: ["Jemaa el-Fnaa", "Place des Nations Unies", "Place Mohammed V", "Bab Doukkala"],
    correctIndex: 0,
    explanation: "Jemaa el-Fnaa is a major public gathering place in the medina.",
    points: 100,
    category: "Heritage",
  },
  {
    id: "q-founder",
    question: "Which dynasty established Marrakech around 1070–1071?",
    options: ["The Almoravids", "The Saadians", "The Marinids", "The Idrisids"],
    correctIndex: 0,
    explanation: "Marrakech was founded by the Almoravids in the late 11th century.",
    points: 100,
    category: "History",
  },
  {
    id: "q-zellige",
    question: "What material is traditionally used to make zellige tiles?",
    options: ["Glazed ceramic", "Carved limestone", "Painted cedar", "Woven wool"],
    correctIndex: 0,
    explanation: "Zellige is a form of geometric mosaic made from glazed ceramic pieces.",
    points: 100,
    category: "Craft",
  },
  {
    id: "q-walls",
    question: "What gives many Marrakech walls their characteristic warm red or ochre appearance?",
    options: ["Earth-based building materials and pigments", "Copper sheet cladding", "Red-painted timber", "Volcanic glass"],
    correctIndex: 0,
    explanation: "Local earth and traditional materials contribute to the city's familiar red-earth and ochre tones.",
    points: 100,
    category: "Architecture",
  },
  {
    id: "q-saadian",
    question: "The Saadian Tombs are associated with which Moroccan dynasty?",
    options: ["The Saadians", "The Almoravids", "The Wattasids", "The Idrisids"],
    correctIndex: 0,
    explanation: "The tomb complex is associated with the Saadian dynasty.",
    points: 100,
    category: "History",
  },
  {
    id: "q-tea",
    question: "Which ingredient is commonly added to Moroccan mint tea?",
    options: ["Fresh mint leaves", "Cocoa nibs", "Rosemary flowers", "Saffron rice"],
    correctIndex: 0,
    explanation: "Fresh mint is a familiar ingredient in Moroccan mint tea, though serving practices vary.",
    points: 100,
    category: "Traditions",
  },
  {
    id: "q-gnawa",
    question: "Which instrument is associated with Gnawa music?",
    options: ["Sintir", "Bagpipes", "Koto", "Steel pan"],
    correctIndex: 0,
    explanation: "The sintir, a three-stringed bass lute, is among the instruments associated with Gnawa music.",
    points: 100,
    category: "Music",
  },
  {
    id: "q-qraqeb",
    question: "What are qraqeb?",
    options: ["Metal castanets used in Gnawa music", "A type of zellige tile", "A sweet pastry", "A courtyard fountain"],
    correctIndex: 0,
    explanation: "Qraqeb are large metal castanets played in Gnawa music.",
    points: 100,
    category: "Music",
  },
  {
    id: "q-couscous",
    question: "What is couscous primarily made from?",
    options: ["Granules of semolina", "Ground almonds", "Fermented milk", "Barley tea"],
    correctIndex: 0,
    explanation: "Couscous is made from small granules of semolina, commonly from durum wheat.",
    points: 100,
    category: "Food",
  },
  {
    id: "q-palace",
    question: "Which Marrakech palace is known for its courtyards and intricate decorative work?",
    options: ["Bahia Palace", "El Badi Palace only", "Royal Palace of Fez", "Dar Batha"],
    correctIndex: 0,
    explanation: "Bahia Palace is celebrated for its decorated rooms, courtyards, and gardens.",
    points: 100,
    category: "Architecture",
  },
  {
    id: "q-unesco",
    question: "What kind of heritage is recognized at Jemaa el-Fnaa by UNESCO?",
    options: ["Intangible cultural heritage", "Underwater archaeology", "Industrial heritage", "Natural landscape heritage"],
    correctIndex: 0,
    explanation: "UNESCO recognizes the cultural space of Jemaa el-Fnaa as intangible cultural heritage.",
    points: 100,
    category: "Heritage",
  },
];

const answerPositions = [2, 1, 3, 0, 1, 3, 2, 0, 3, 2, 1, 0, 2, 1, 3];
const quizSeeds = originalQuizSeeds.map((seed, index) => {
  const correctIndex = answerPositions[index] ?? seed.correctIndex;
  const correctAnswer = seed.options[seed.correctIndex];
  const options = seed.options.filter((_, optionIndex) => optionIndex !== seed.correctIndex);
  options.splice(correctIndex, 0, correctAnswer);
  return { ...seed, options, correctIndex };
});

export async function seedMarrakechContent(): Promise<void> {
  const [slideCount] = await db.select({ value: count() }).from(slidesTable);
  if (Number(slideCount?.value ?? 0) === 0) {
    await db.insert(slidesTable).values(slideSeeds);
  }

  const [questionCount] = await db.select({ value: count() }).from(quizQuestionsTable);
  if (Number(questionCount?.value ?? 0) === 0) {
    await db.insert(quizQuestionsTable).values(quizSeeds);
    return;
  }

  const seededIds = originalQuizSeeds.map((question) => question.id);
  const [existingQuestions, quizRuns] = await Promise.all([
    db.select().from(quizQuestionsTable).where(inArray(quizQuestionsTable.id, seededIds)),
    db.select({ questionIds: quizRunsTable.questionIds }).from(quizRunsTable),
  ]);
  const referencedQuestionIds = new Set(quizRuns.flatMap((run) => run.questionIds));
  const existingById = new Map(existingQuestions.map((question) => [question.id, question]));
  for (const [index, original] of originalQuizSeeds.entries()) {
    const existing = existingById.get(original.id);
    const revised = quizSeeds[index];
    if (
      !existing ||
      !revised ||
      referencedQuestionIds.has(original.id) ||
      existing.question !== original.question ||
      existing.correctIndex !== original.correctIndex ||
      JSON.stringify(existing.options) !== JSON.stringify(original.options)
    ) {
      continue;
    }
    await db
      .update(quizQuestionsTable)
      .set({ options: revised.options, correctIndex: revised.correctIndex })
      .where(eq(quizQuestionsTable.id, original.id));
  }
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Curated seed data - representative books from each category
const seedBooks = [
  // Hadith & Sunnah
  {
    title: "The 40 Hadith of Imam al-Nawawi",
    author: "Imam al-Nawawi",
    description: "A collection of forty-two authentic hadith that are considered among the most important teachings of Islam. Each hadith is a foundation stone of Islamic law and guidance.",
    price: 22.00,
    images: [""],
    stock: 15,
    categories: ["Hadith & Sunnah"]
  },
  {
    title: "Fortress of the Muslim",
    author: "Said bin Ali bin Wahf Al-Qahtani",
    description: "A comprehensive collection of authentic du'as and dhikr from the Quran and Sunnah for daily life situations.",
    price: 5.00,
    images: [""],
    stock: 25,
    categories: ["Hadith & Sunnah"]
  },
  {
    title: "40 on Justice - The Prophetic Voice on Social Reform",
    author: "Omar Suleiman",
    description: "A powerful collection of 40 hadith and Quranic verses that highlight the prophetic voice on social justice and reform.",
    price: 18.00,
    images: [""],
    stock: 10,
    categories: ["Hadith & Sunnah"]
  },

  // Quran & Tafsir
  {
    title: "The Study Quran: A New Translation and Commentary",
    author: "Seyyed Hossein Nasr",
    description: "A comprehensive study Quran with detailed commentary drawing from classical and contemporary Islamic scholarship.",
    price: 45.00,
    images: [""],
    stock: 8,
    categories: ["Quran & Tafsir"]
  },
  {
    title: "Tafsir Ibn Kathir (Abridged)",
    author: "Ibn Kathir",
    description: "An abridged version of the classical Quranic commentary by the renowned Islamic scholar Ibn Kathir.",
    price: 35.00,
    images: [""],
    stock: 12,
    categories: ["Quran & Tafsir"]
  },

  // Biography & Seerah
  {
    title: "The Sealed Nectar",
    author: "Safiur Rahman al-Mubarakpuri",
    description: "A comprehensive biography of Prophet Muhammad (peace be upon him) that won first prize in a worldwide competition on the Prophet's biography.",
    price: 25.00,
    images: [""],
    stock: 20,
    categories: ["Biography & Seerah"]
  },
  {
    title: "Khadijah: Mother of History's Greatest Nation",
    author: "Fatima Barkatulla",
    description: "The inspiring story of Khadijah (may Allah be pleased with her), the first wife of Prophet Muhammad and the first person to embrace Islam.",
    price: 25.00,
    images: [""],
    stock: 15,
    categories: ["Biography & Seerah"]
  },

  // Children's Books
  {
    title: "My First Book About Allah",
    author: "Learning Roots",
    description: "An introduction to Allah for young children with beautiful illustrations and simple concepts.",
    price: 12.00,
    images: [""],
    stock: 30,
    categories: ["Children's Books"]
  },
  {
    title: "The Way to Jannah",
    author: "Learning Roots",
    description: "Children learn the key to Jannah through this interactive lift-the-flap book designed for fathers and daughters.",
    price: 18.00,
    images: [""],
    stock: 25,
    categories: ["Children's Books"]
  },

  // Children's Games
  {
    title: "What to Say When - Children's Game",
    author: "Learning Roots",
    description: "Educational flash cards teaching children important Islamic supplications for daily situations.",
    price: 22.00,
    images: [""],
    stock: 20,
    categories: ["Children's Games"]
  },
  {
    title: "The Giant Journey Puzzle",
    author: "Learning Roots",
    description: "A 178-piece puzzle featuring all the Prophets in chronological order, perfect for learning and family time.",
    price: 30.00,
    images: [""],
    stock: 15,
    categories: ["Children's Games"]
  },

  // Islamic Literature
  {
    title: "The Ideal Muslim",
    author: "Dr. Muhammad Ali al-Hashimi",
    description: "A comprehensive guide to Islamic character and conduct, showing how to live as an ideal Muslim in today's world.",
    price: 24.00,
    images: [""],
    stock: 18,
    categories: ["Islamic Literature"]
  },
  {
    title: "Don't Be Sad",
    author: "Dr. Aaidh ibn Abdullah al-Qarni",
    description: "A book of hope and healing, offering Islamic guidance for overcoming sadness, depression, and life's challenges.",
    price: 24.00,
    images: [""],
    stock: 22,
    categories: ["Islamic Literature"]
  },

  // Dua & Dhikr
  {
    title: "The Daily Du'a Book",
    author: "Various Scholars",
    description: "A collection of authentic du'as from the Quran and Sunnah for morning, evening, and daily activities.",
    price: 22.00,
    images: [""],
    stock: 25,
    categories: ["Dua & Dhikr"]
  },

  // Fiqh & Islamic Law
  {
    title: "The Essentials of Islamic Jurisprudence",
    author: "Dr. Ahmad ibn Naqib al-Misri",
    description: "A comprehensive introduction to Islamic law covering worship, transactions, and social interactions.",
    price: 28.00,
    images: [""],
    stock: 10,
    categories: ["Fiqh & Islamic Law"]
  },

  // Hajj & Umrah (was Aqeedah & Theology)
  {
    title: "The Fundamentals of Islamic Belief",
    author: "Dr. Abu Ameenah Bilal Philips",
    description: "A clear explanation of the six pillars of Islamic faith and their significance in a Muslim's life.",
    price: 20.00,
    images: [""],
    stock: 15,
    categories: ["Hajj & Umrah"]
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');
    
    // Check if database is empty
    const existingBooks = await prisma.book.count();
    
    if (existingBooks > 0) {
      console.log(`⚠️  Database already contains ${existingBooks} books.`);
      console.log('Seeding is typically used for empty databases.');
      console.log('To replace existing data, use the backup/restore system instead.\n');
      console.log('Options:');
      console.log('1. Use "npm run db:reset" to clear database first');
      console.log('2. Use "npm run db:restore" to restore from backup');
      console.log('3. Continue seeding anyway (this will add to existing data)');
      return;
    }
    
    console.log('📚 Seeding database with curated Islamic books...\n');
    
    // Insert seed books
    let seedCount = 0;
    for (const book of seedBooks) {
      // Ensure all categories exist and get their IDs
      const categoryConnect = [];
      for (const catName of book.categories) {
        const category = await prisma.category.upsert({
          where: { name: catName },
          update: {},
          create: { name: catName },
        });
        categoryConnect.push({ id: category.id });
      }
      await prisma.book.create({
        data: {
          title: book.title,
          author: book.author,
          description: book.description,
          price: book.price,
          images: book.images,
          stock: book.stock,
          categories: {
            connect: categoryConnect,
          },
        },
      });
      seedCount++;
      console.log(`✅ Added: ${book.title} by ${book.author}`);
    }
    
    const totalBooks = await prisma.book.count();
    console.log(`\n🎉 Successfully seeded ${seedCount} books!`);
    console.log(`📊 Total books in database: ${totalBooks}`);
    
    // Show category distribution
    const categories = await getCategoryDistribution();
    
    console.log('\n📊 Category distribution:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} books`);
      });
    
    console.log('\n✨ Database seeding completed successfully!');
    console.log('💡 Your bookstore is now ready for development and testing.');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase().catch(console.error);
}

export default seedDatabase;

// Category distribution: count books per category
async function getCategoryDistribution() {
  const categories = await prisma.category.findMany({
    include: { books: true },
    orderBy: { name: 'asc' },
  });
  const dist: Record<string, number> = {};
  for (const cat of categories) {
    dist[cat.name] = cat.books.length;
  }
  return dist;
} 
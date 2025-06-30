import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newBooks = [
  {
    title: "Preparing for Life [Paperback]",
    author: "Muhammad Abdul Bari",
    description: "We live in a time of complexity and uncertainty within modern life. Whilst the overuse of technology and social media has reduced human interaction in families and neighbourhoods, we have also seen an upsurge of empathy and compassion for fellow human beings during times of difficulty and crises. Positive parenting is about raising a child as a better human being and a better citizen. Our parental obligation is to help children grow into mature and confident adults with a positive character and good social and life skills. Preparing for Life is a reminder to, particularly, Muslim parents about their unique and entrusted role in preparing their children for life with universal human and Islamic values.",
    price: 14,
    images: ["preparing-for-life.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "The Easy Quran: A Translation in Simple English [Hardcover]",
    author: "Tahir Mahmood Kiani",
    description: "The Easy Quran: A translation in simple English is just that - a translation in plain, everyday English. The verses have been arranged in paragraphs to aid flow and understanding. This would make an ideal first Quran for young people, adults who are new to the Quran as well as those who simply wish to read an undemanding translation. There are: No diacritics, No archaic language and No untranslated words.",
    price: 33,
    images: ["easy-quran.jpg"],
    stock: 2,
    categories: ["Quran & Tafsir"]
  },
  {
    title: "A Day with the Prophet [Paperback]",
    author: "Ahmad Von Denffer",
    description: "This book invites Muslims and non-Muslims to acquaint themselves with the prophet's practice and teachings, his Sunnah, first hand. Relying exclusively upon the sayings and actions of the prophet, which have been selected and translated from authenticated and well-known collections of hadith literature, this book presents a close-up and composite picture of the life of the Prophet Muhammad, described in the Qur'an as the best model for humanity.",
    price: 14,
    images: ["a-day-with-prophet.jpg"],
    stock: 2,
    categories: ["Biography & Seerah"]
  },
  {
    title: "Women in Islam: What the Qur'an and Sunnah Say [Paperback]",
    author: "Abdur Raheem Kidwai",
    description: "Women in Islam is an attractive book of simple compilation of quotations from the Qur'an and Hadith collections that refer to or address women specifically. It engages the reader in a moment of reflection on the Islamic view of womanhood: her existence as a creation of Allah, her role as a positive stakeholder in building a God-conscious society and her capacity for attaining proximity with Allah.",
    price: 16,
    images: ["women-in-islam.jpg"],
    stock: 3,
    categories: ["Women In Islam"]
  },
  {
    title: "A Du'a Away: A Companion Journal [Paperback]",
    author: "Omar Suleiman",
    description: "One should never underestimate the power of du'a as it can change your destiny. The Prophet Muhammad  used to make certain du'as in certain situations, but what if one feels that they are not worthy of calling upon Allah or just simply don't know how.",
    price: 15,
    images: ["a-dua-away.jpg"],
    stock: 3,
    categories: ["Dua & Dhikr"]
  },
  {
    title: "The Qur'anic Prescription: Unlocking the Secrets to Optimal Health [Paperback]",
    author: "Madiha M. Saeed",    
    description: "What are the hidden Qur'anic gems that lead to optimal faith, success, taqwa and overall health? Allah has given us the answers. He has taught us how we eat, drink, sleep, behave and live--all to maintain perfect balance and harmony. And yet, when we disrupt Allah's balance, we contribute to the global epidemic of lifestyle-based chronic diseases affecting our mind, body, spirit and even the planet.",
    price: 20,
    images: ["quranic-prescription.jpg"],
    stock: 2,
    categories: ["Other"]
  },
  {
    title: "Trials and Tribulations: An Islamic Perspective [Hardcover]",
    author: "Faisal Malik",    
    description: "Trials and An Islamic Perspective oﬀers an insight into how to deal with life's challenges with grace, positivity and strength. Rooted in the Qur'an and Sunnah, this book seeks * Place the life of this world into perspective. * Encourage the growth that can be achieved in the midst of difficulties. * Soothe the heart through practical advice and selected du'as.",
    price: 24,
    images: ["trials-and-tribulations.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "A Treasury of Rumi's Wisdom [Hardcover]",
    author: "Muhammad Isa Waley",    
    description: "This new anthology is freshly translated and supplemented with commentaries, and also includes selected texts in Persian. The aim is to bring readers a full appreciation of the true, traditional nature of his work- and to the man himself as a great Muslim teacher and spiritual guide. Besides illustrating the traditional basis of Jalāl al-Dīn's teachings, this Treasury displays his unique literary genius as well as his profundity as one of the world's greatest religious writers, whose voice speaks as clearly and compellingly today as it did in the 7th/13th century.",
    price: 17,
    images: ["treasury-of-rumi.jpg"],
    stock: 2,
    categories: ["Other"]
  },
  {
    title: "Revive Your Heart: Putting Life in Perspective [Paperback]",
    author: "Nouman Ali Khan",    
    description: "Revive Your Heart is a call for spiritual renewal and an invitation to have a conversation with one of the world's most recognizable voices on Islam, Nouman Ali Khan.This collection of essays is disarmingly simple, yet it challenges us to change. To revise our actions, our assumptions and our beliefs so we can be transformed from within, as well as externally. It aims to help modern Muslims maintain a spiritual connection with Allah and to address the challenges facing believers today: the disunity in the Muslim community, terrorists acting in the name of Islam, and the disconnection with Allah.",
    price: 18,
    images: ["revive-your-heart.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "Light Upon Light [Paperback]",
    author: "Nur Fadhilah Wahid", 
    description: "Mostly written while she was traveling, living and studying in Malaysia, South Africa and Yemen, Light Upon Light is a heartfelt and sincere conversation, sprinkled with humor and self-doubt, on the challenges of a modern-day Muslimah.",
    price: 14,
    images: ["light-upon-light.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "Turning the Tide: Reawakening the Women's Heart and Soul [Hardcover]",
    author: "Din Suma", 
    description: "A book on the journey and different stages of a woman's life, from the inception of the soul to the end of life on Earth. With contemporary thoughts, words of wisdom, guidance and inspiration.",
    price: 22,
    images: ["turning-the-tide.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "One Breath At A Time: Finding Solace in Faith [Paperback]",
    author: "Salatu E Sule", 
    description: "Life is not always easy. We face challenges, difficulties and hardship throughout our life journey. These highs and lows are a part of life. Sometimes however, we need that reminder that Allah is always there and these moments of hardship are not punishments but trials from Him to strengthen us, guide us and elevate us....one breath at a time. Faith, and knowing that we are never alone, shines a light in the dark spaces that grief creates within the heart. This book offers faith–inspired insights about grief and how to build resilience, one breath at a time.",
    price: 22,
    images: ["one-breath-at-a-time.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "Al-Rashidun: The Way of the Rightly Guided [Hardcover]",
    author: "Ilm Forum", 
    description: "The legacy of the greatest teacher the world has known, the greatest man to ever walk the Earth, the Messenger of Allah, is attested to by the greatness of his students: the Ṣaḥābah. None more so than his four successors, the four men famed as the Rightly Guided Caliphs. The Blessed Prophet's words and deeds have reached us from across the centuries and still inspire billions. It was these men who were charged with carrying those teachings to others, and within one short century spread them across the breadth of the world. This book collects the teachings of these great men; their words and their actions; how they lived and how they died. Each of them was a giant upon whose shoulders the great scholars and sages; the orators and leaders; the warriors and heroes; the ascetics and mystics in every age of this Ummah have built their places in the halls of history. Each of them was shaped for greatness by the blessed hands of the Beloved in a singular and unique manner. Together, they built a community, an empire, and a legacy that shall inspire this Ummah until the end of time.",
    price: 20,
    images: ["al-rashidun.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "The Future of Economics: An Islamic Perspective [Paperback]",
    author: "M. Umer Chapra", 
    description: "This profound book is a powerful yet balanced critique of mainstream economics that makes a forceful plea for taking economics out of its secular and occident-centred cocoon. It presents an innovative and formidable case to re-link economics with moral and egalitarian concerns so as to harness the discipline in the service of humanity. M. Umer Chapra is ranked amongst the Top 50 Global Leaders in Islamic economics (ISLAMICA 500, 2015) and has been awarded with two prestigious awards for his contributions to the field: Islamic Development Bank Award for Islamic Economics (1989) and the King Faisal International Prize for Islamic Studies (1989).",
    price: 25,
    images: ["future-of-economics.jpg"],
    stock: 2,
    categories: ["Other"]
  },
  {
    title: "The Muslim 100: The Lives, Thoughts and Achievements of the Most Influential Muslims in History [Hardcover]",
    author: "Muhammad Mojlum Khan", 
    description: "Who have been the Muslim world's most influential people? What were their ideas, thoughts, and achievements? In one hundred short and engaging profiles of these extraordinary people, fourteen hundred years of the vast and rich history of the Muslim world is unfolded. For anyone interested in getting an intimate view of Islam through its kings and scholars, generals and sportsmen, architects and scientists, and many others—this is the book for you. Among those profiled are the Prophet Muhammad, the Caliph Umar, Imam Husain, Abu Hanifa, Harun al-Rashid, al-Khwarizmi, al-Ghazali, Saladin, Rumi, Ibn Battuta, Sinan, Ataturk, Iqbal, Jinnah, Ayatollah Khomeini, Malcolm X, and Muhammad Ali.",
    price: 25,
    images: ["the-muslim-100.jpg"],
    stock: 2,
    categories: ["Other"]
  },
  {
    title: "Home Sweet Home: Building Harmonious Foundations [Paperback]",
    author: "Belal Assaad", 
    description: "At its core, Home Sweet Home is about relationships: the power it has over one's sense of peace and self and how knowing one's rights and duties can empower one to confidently set boundaries. Most importantly, it discusses issues and conflicts that may exist within the home and how to ensure they are not mismanaged and handled disproportionately. It emphasizes the need to reflect and ponder over the origins of conflict and aims to make its readers more cognizant of the Islamic principles related to every relationship and interaction. In particular, there is a focus on the positive impact faith can have on smoothing out many common problems.",
    price: 16,
    images: ["home-sweet-home.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "Your Lord Has Not Forsaken You [Paperback]",
    author: "Najwa Awad & Sarah Sultan", 
    description: "Trauma is more common than you think. Well over half of your friends, colleagues, and closest family members have experienced harrowing events in their lives. Maybe you have, too. Trauma can dwell in the body for years or even decades, unrecognized but draining your energy, happiness, and even your faith. But through all the numbness or pain you may feel, and all the hardships you experience, Allah is still there for you. This book is a guide to understanding trauma and its far-reaching effects on the body, mind, and soul. With that understanding in place, we can recognize how it leads to cognitive biases and doubts around faith—and then begin to grow beyond these roadblocks and find contentment.",
    price: 28,
    images: ["your-lord-has-not-forsaken-you.jpg"],
    stock: 2,
    categories: ["Self Development"]
  },
  {
    title: "The Power of Du'a [Paperback]",
    author: "Aliyah Umm Raiyaan", 
    description: "Faith transforms what seems impossible. The Power of Du'a, guides you on a journey of personal supplication. Discover real-life stories of miraculous transformations and learn tools from the Qur'an and Sunnah to prepare your heart with sincerity; Ask with unwavering faith, Trust in His perfect plan, Deeply moving, this book empowers you to connect with the Divine and embrace the possibilities awaiting you.",
    price: 24,
    images: ["power-of-dua.jpg"],
    stock: 3,
    categories: ["Self Development", "Dua & Dhikr"]
  },
  {
    title: "The Wealth of Women: Understanding Islamic Financial Laws [Paperback]",
    author: "Rabab Razik", 
    description: "Embark on a journey through the various stages of life, from marriage to divorce and widowhood, to witness how women living within the Islamic tradition are endowed with the right to safeguard their financial independence. This comprehensive exploration confronts an ongoing disconnect between Islamic law and Muslim family dynamics to equip men and women alike with the knowledge and tools to uphold an important body of Islamic financial laws. Importantly, the book fosters a deep understanding of how Islamic financial empowerment plays a pivotal role in shaping not just the lives of women and their family members, but society as a whole",
    price: 21,
    images: ["wealth-of-women.jpg"],
    stock: 2,
    categories: ["Fiqh & Islamic Law", "Women In Islam"]
  },
  {
    title: "The Four Imams [Paperback]",
    author: "Ali Hammuda", 
    description: "The Four Imams provides an engaging and informative account of the four most well-renowned Imams in Islamic history - Iman Abu Hanifa, Imam Malik, Imam Shafi'i and Imam Ahmad. Adopting a story-telling style, it relays biographical information, summarising their fascinating life journeys, alongside lessons and conclusions that have real-world application for the reader in an age-appropriate manner.",
    price: 15,
    images: ["four-imams.jpg"],
    stock: 2,
    categories: ["Fiqh & Islamic Law", "Islamic History"]
  },
  {
    title: "A Beautiful Homecoming [Paperback]",
    author: "LaYinka Sanni", 
    description: "LáYínká, if you died today, what would your children have to say about you? This was the question LáYínká Sánní asked herself when she hit rock bottom years ago. It was this question — and the uncomfortable answer that followed it — that inspired her to embark on a deeply personal journey of self discovery, learning and, ultimately, homecoming. Honest, tender and wise, A Beautiful Homecoming is a self-help book for every Muslim woman who has become buried beneath her labels — mother, wife, daughter, sister, friend, employee — and who wants to reconnect with who she is and finally embrace all parts of herself. Drawing on her work as a transformation coach, her own personal experiences and her faith, LáYínká Sánní offers a powerful love letter from one striving woman to another, an invitation to step into a new internal reality, and a practical guide to transforming how you view both the world and yourself — forever.",
    price: 17,
    images: ["a-beautiful-homecoming.jpg"],
    stock: 2,
    categories: ["Self Development", "Women In Islam"]
  },
];

async function addBooks() {
  try {
    for (const book of newBooks) {
      // Check if the book already exists (by title)
      const existing = await prisma.book.findFirst({ where: { title: book.title } });
      if (existing) {
        console.log(`⚠️  Book "${book.title}" already exists. Skipping.`);
        continue;
      }

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

      // Ensure image paths are prefixed with /book-images/
      const imagesWithPath = book.images.map(img =>
        img.startsWith('/book-images/') || img.startsWith('http://') || img.startsWith('https://')
          ? img
          : `/book-images/${img}`
      );

      // Create the new book
      await prisma.book.create({
        data: {
          title: book.title,
          author: book.author,
          description: book.description,
          price: book.price,
          images: imagesWithPath,
          stock: book.stock,
          categories: {
            connect: categoryConnect,
          },
        },
      });

      console.log(`✅ Added: ${book.title} by ${book.author}`);
    }
  } catch (error) {
    console.error('❌ Error adding books:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addBooks(); 
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

const categoriesData = [
  { name: "Cuisine et Art de la Table", slug: "cuisine", description: "Ustensiles, vaisselle et accessoires de cuisine", sortOrder: 1 },
  { name: "Electroménager", slug: "electromenager", description: "Appareils électroménagers pour la maison", sortOrder: 2 },
  { name: "Entretien", slug: "entretien", description: "Produits de nettoyage et d'entretien", sortOrder: 3 },
  { name: "Maison", slug: "maison", description: "Décoration et articles pour la maison", sortOrder: 4 },
  { name: "Soins & Beauté", slug: "soins-beaute", description: "Produits de soins et de beauté", sortOrder: 5 },
  { name: "Électronique", slug: "electronique", description: "Gadgets et appareils électroniques", sortOrder: 6 },
  { name: "Sport", slug: "sport", description: "Équipements et accessoires de sport", sortOrder: 7 },
];

const productsData = [
  { name: "Philips Home Mixeur plongeant", slug: "philips-mixeur-plongeant", description: "• Mixeur plongeant avec un gobelet Philips Daily Collection\n• Idéal pour préparer facilement des aliments faits maison et sains\n• Couleur : blanc avec des accents gris\n• Capacité : 0,5 L\n• Puissance : 550W", price: 20000, categoryId: 1, imageUrl: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=500", isFeatured: 1, isNew: 0, isTrending: 1 },
  { name: "Assiette Ethnique Céramique 18.7cm", slug: "assiette-ethnique-ceramique", description: "• Assiette en céramique avec motifs ethniques colorés\n• Diamètre : 18.7 cm\n• Résistante au lave-vaisselle\n• Idéale pour la décoration de table", price: 3500, categoryId: 1, imageUrl: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
  { name: "Presse-agrumes Détox Juicy", slug: "presse-agrumes-detox", description: "• Presse-agrumes et multi-fruits avec contenant intégré\n• Idéal pour les jus frais et détox\n• Facile à nettoyer\n• Matériau : plastique alimentaire sans BPA", price: 5000, categoryId: 1, imageUrl: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=500", isFeatured: 1, isNew: 0, isTrending: 0 },
  { name: "Bouilloire Cook Concept 1,5 L", slug: "bouilloire-cook-concept", description: "• Bouilloire électrique 1,5 L\n• Chauffage rapide\n• Arrêt automatique\n• Base pivotante 360°\n• Indicateur de niveau d'eau", price: 9000, categoryId: 1, imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500", isFeatured: 0, isNew: 1, isTrending: 1 },
  { name: "Mug Effet Marbre Porcelaine", slug: "mug-effet-marbre", description: "• Mug en porcelaine avec effet marbre\n• Couleurs : blanc, gris, noir\n• Capacité : 350 ml\n• Passe au lave-vaisselle et micro-ondes", price: 2500, categoryId: 1, imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500", isFeatured: 0, isNew: 0, isTrending: 1 },
  { name: "Saladier Coupe-Salade", slug: "saladier-coupe-salade", description: "• Saladier avec système de coupe intégré\n• Préparez votre salade en 60 secondes\n• Matériau : plastique alimentaire\n• Passe au lave-vaisselle", price: 4000, categoryId: 1, imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500", isFeatured: 0, isNew: 0, isTrending: 0 },
  { name: "Ventilateur sur Pied 40cm", slug: "ventilateur-pied-40cm", description: "• Ventilateur sur pied oscillant\n• 3 vitesses de ventilation\n• Hauteur réglable\n• Diamètre : 40 cm\n• Puissance : 45W", price: 15000, categoryId: 2, imageUrl: "https://images.unsplash.com/photo-1617375407633-acd67aba7864?w=500", isFeatured: 1, isNew: 0, isTrending: 1 },
  { name: "Fer à Repasser Vapeur 2200W", slug: "fer-repasser-vapeur", description: "• Fer à repasser à vapeur\n• Puissance : 2200W\n• Semelle antiadhésive\n• Réservoir : 300 ml\n• Fonction anti-calcaire", price: 12000, categoryId: 2, imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
  { name: "Blender Multifonction 1.5L", slug: "blender-multifonction", description: "• Blender multifonction avec bol en verre 1.5L\n• 5 vitesses + fonction pulse\n• Lames en acier inoxydable\n• Puissance : 500W\n• Facile à nettoyer", price: 18000, categoryId: 2, imageUrl: "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500", isFeatured: 1, isNew: 1, isTrending: 1 },
  { name: "Lingettes Désinfectantes LYSOL", slug: "lingettes-lysol", description: "• Lingettes désinfectantes multi-surfaces\n• Élimine 99.9% des bactéries\n• Parfum frais\n• Paquet de 80 lingettes", price: 3500, categoryId: 3, imageUrl: "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
  { name: "Destructeur d'Insectes Électrique 30W", slug: "destructeur-insectes", description: "• Destructeur d'insectes électrique UV\n• Puissance : 30W\n• Couverture : 50m²\n• Sans produits chimiques\n• Silencieux", price: 8000, categoryId: 3, imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=500", isFeatured: 1, isNew: 0, isTrending: 1 },
  { name: "Désodorisant AIR WICK FRESHMATIC", slug: "desodorisant-airwick", description: "• Désodorisant automatique\n• Diffusion programmable\n• Parfum longue durée\n• Recharge incluse", price: 2000, categoryId: 3, imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=500", isFeatured: 0, isNew: 0, isTrending: 0 },
  { name: "Coussin Déhoussable 40x40 cm", slug: "coussin-dehoussable", description: "• Coussin décoratif déhoussable\n• Dimensions : 40x40 cm\n• Housse lavable en machine\n• Garnissage moelleux", price: 9900, categoryId: 4, imageUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
  { name: "Miroir Rond Blanc Décoratif", slug: "miroir-rond-blanc", description: "• Miroir rond avec cadre blanc\n• Diamètre : 50 cm\n• Style scandinave\n• Fixation murale incluse", price: 22500, categoryId: 4, imageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?w=500", isFeatured: 1, isNew: 0, isTrending: 1 },
  { name: "Horloge Murale Design", slug: "horloge-murale-design", description: "• Horloge murale au design moderne\n• Mouvement silencieux\n• Diamètre : 30 cm\n• Fonctionne avec 1 pile AA", price: 7500, categoryId: 4, imageUrl: "https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=500", isFeatured: 0, isNew: 0, isTrending: 1 },
  { name: "Bulldog Sculpture 14 cm", slug: "bulldog-sculpture", description: "• Sculpture décorative bulldog\n• Hauteur : 14 cm\n• Matériau : résine\n• Finition brillante", price: 17000, categoryId: 4, imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500", isFeatured: 1, isNew: 1, isTrending: 0 },
  { name: "Neutrogena Spot Control", slug: "neutrogena-spot-control", description: "• Traitement anti-imperfections\n• Formule à l'acide salicylique\n• Réduit les boutons rapidement\n• Pour peaux à tendance acnéique", price: 3000, categoryId: 5, imageUrl: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500", isFeatured: 0, isNew: 0, isTrending: 1 },
  { name: "Masque Relaxant Argile Yeux", slug: "masque-argile-yeux", description: "• Masque relaxant pour les yeux à l'argile\n• Réduit les cernes et poches\n• Effet rafraîchissant\n• Réutilisable", price: 4500, categoryId: 5, imageUrl: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=500", isFeatured: 1, isNew: 1, isTrending: 0 },
  { name: "Lotion Corporelle Dove Body Love", slug: "lotion-dove-body-love", description: "• Lotion corporelle hydratante\n• Formule enrichie au beurre de karité\n• Hydratation 48h\n• Pour peaux sèches", price: 2800, categoryId: 5, imageUrl: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500", isFeatured: 0, isNew: 0, isTrending: 1 },
  { name: "Serviette Microfibre Démaquillante", slug: "serviette-microfibre", description: "• Serviette démaquillante en microfibre\n• Démaquillage à l'eau uniquement\n• Réutilisable et lavable\n• Douce pour la peau", price: 2000, categoryId: 5, imageUrl: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
  { name: "Écouteurs Bluetooth Sans Fil", slug: "ecouteurs-bluetooth", description: "• Écouteurs Bluetooth 5.0\n• Autonomie : 6h (24h avec boîtier)\n• Réduction de bruit passive\n• Résistant à la transpiration IPX4", price: 12000, categoryId: 6, imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=500", isFeatured: 1, isNew: 1, isTrending: 1 },
  { name: "Enceinte Portable Bluetooth", slug: "enceinte-portable", description: "• Enceinte Bluetooth portable\n• Son stéréo puissant\n• Autonomie : 12h\n• Étanche IPX7", price: 15000, categoryId: 6, imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500", isFeatured: 1, isNew: 0, isTrending: 1 },
  { name: "Chargeur Solaire Portable 10000mAh", slug: "chargeur-solaire", description: "• Batterie externe solaire 10000mAh\n• Double port USB\n• Charge solaire + USB\n• Lampe LED intégrée", price: 8500, categoryId: 6, imageUrl: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
  { name: "Lumières de Roue de Vélo LED", slug: "lumieres-velo-led", description: "• Lumières LED pour roues de vélo\n• 30 motifs lumineux\n• Étanche\n• Installation facile", price: 4000, categoryId: 6, imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500", isFeatured: 0, isNew: 0, isTrending: 1 },
  { name: "Tapis de Yoga Antidérapant", slug: "tapis-yoga", description: "• Tapis de yoga antidérapant\n• Épaisseur : 6 mm\n• Matériau : TPE écologique\n• Dimensions : 183x61 cm", price: 8000, categoryId: 7, imageUrl: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500", isFeatured: 1, isNew: 0, isTrending: 1 },
  { name: "Haltères Réglables 20kg", slug: "halteres-reglables", description: "• Set d'haltères réglables\n• Poids total : 20 kg\n• Disques en fonte revêtus\n• Barres chromées antidérapantes", price: 25000, categoryId: 7, imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500", isFeatured: 1, isNew: 1, isTrending: 0 },
  { name: "Corde à Sauter Professionnelle", slug: "corde-a-sauter", description: "• Corde à sauter professionnelle\n• Câble en acier gainé\n• Poignées ergonomiques\n• Longueur réglable : 3m", price: 3500, categoryId: 7, imageUrl: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500", isFeatured: 0, isNew: 0, isTrending: 1 },
  { name: "Jeu de Poker 200 Jetons", slug: "jeu-poker-200", description: "• Coffret de poker 200 jetons\n• Jetons en composite\n• 2 jeux de cartes inclus\n• Bouton dealer", price: 10000, categoryId: 7, imageUrl: "https://images.unsplash.com/photo-1541278107931-e006523892df?w=500", isFeatured: 0, isNew: 1, isTrending: 0 },
];

async function seed() {
  console.log("🌱 Seeding database...");

  for (const cat of categoriesData) {
    try {
      await db.execute(sql`INSERT INTO categories (name, slug, description, sortOrder) VALUES (${cat.name}, ${cat.slug}, ${cat.description}, ${cat.sortOrder}) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), sortOrder=VALUES(sortOrder)`);
      console.log(`  ✓ Category: ${cat.name}`);
    } catch (e) {
      console.log(`  ⚠ Category ${cat.name}: ${e.message}`);
    }
  }

  for (const prod of productsData) {
    try {
      await db.execute(sql`INSERT INTO products (name, slug, description, price, categoryId, imageUrl, isFeatured, isNew, isTrending, inStock, stockQuantity) VALUES (${prod.name}, ${prod.slug}, ${prod.description}, ${prod.price}, ${prod.categoryId}, ${prod.imageUrl}, ${prod.isFeatured}, ${prod.isNew}, ${prod.isTrending}, 1, 100) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), price=VALUES(price)`);
      console.log(`  ✓ Product: ${prod.name}`);
    } catch (e) {
      console.log(`  ⚠ Product ${prod.name}: ${e.message}`);
    }
  }

  try {
    const zoneSeed = [
      {
        name: "Dakar Centre",
        slug: "dakar-centre",
        description: "Plateau, Medina, Point E",
        deliveryFee: 2000,
        deliveryDays: 1,
        displayOrder: 1,
      },
      {
        name: "Banlieue Dakar",
        slug: "banlieue-dakar",
        description: "Pikine, Guediawaye, Rufisque",
        deliveryFee: 3000,
        deliveryDays: 2,
        displayOrder: 2,
      },
      {
        name: "Regions",
        slug: "regions",
        description: "Thi'es, Mbour, Saint-Louis et regions",
        deliveryFee: 5000,
        deliveryDays: 3,
        displayOrder: 3,
      },
    ];

    for (const zone of zoneSeed) {
      await db.execute(sql`
        INSERT INTO delivery_zones (name, slug, description, deliveryFee, deliveryDays, isActive, displayOrder)
        VALUES (${zone.name}, ${zone.slug}, ${zone.description}, ${zone.deliveryFee}, ${zone.deliveryDays}, true, ${zone.displayOrder})
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          deliveryFee = VALUES(deliveryFee),
          deliveryDays = VALUES(deliveryDays),
          isActive = VALUES(isActive),
          displayOrder = VALUES(displayOrder)
      `);

      await db.execute(sql`
        INSERT INTO shipping_rates (zoneId, label, minAmountCfa, maxAmountCfa, feeCfa, etaMinHours, etaMaxHours, isActive)
        SELECT dz.id, 'Standard', 0, NULL, ${zone.deliveryFee}, ${zone.deliveryDays * 24}, ${zone.deliveryDays * 24 + 24}, true
        FROM delivery_zones dz
        WHERE dz.slug = ${zone.slug}
          AND NOT EXISTS (
            SELECT 1
            FROM shipping_rates sr
            WHERE sr.zoneId = dz.id
              AND sr.label = 'Standard'
              AND sr.minAmountCfa = 0
          )
      `);
    }
    console.log("  - Shipping zones and rates seeded");
  } catch (e) {
    console.log(`  - Shipping seed: ${e.message}`);
  }

  try {
    const couponSeed = [
      {
        id: "seed-coupon-sen10",
        code: "SEN10",
        type: "PERCENT",
        value: 10,
        minSubtotal: 15000,
      },
      {
        id: "seed-coupon-welcome2000",
        code: "WELCOME2000",
        type: "FIXED",
        value: 2000,
        minSubtotal: 10000,
      },
      {
        id: "seed-coupon-freeship",
        code: "FREESHIP",
        type: "FREE_SHIPPING",
        value: 0,
        minSubtotal: 20000,
      },
    ];

    for (const coupon of couponSeed) {
      await db.execute(sql`
        INSERT INTO coupons (
          id, code, type, value, minSubtotal, maxDiscount, startAt, endAt,
          usageLimit, perSessionLimit, active, createdAt, updatedAt
        ) VALUES (
          ${coupon.id}, ${coupon.code}, ${coupon.type}, ${coupon.value}, ${coupon.minSubtotal},
          NULL, NULL, NULL, NULL, NULL, true, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          code = VALUES(code),
          type = VALUES(type),
          value = VALUES(value),
          minSubtotal = VALUES(minSubtotal),
          active = VALUES(active),
          updatedAt = NOW()
      `);
    }

    console.log("  - Coupons seeded (SEN10, WELCOME2000, FREESHIP)");
  } catch (e) {
    console.log(`  - Coupon seed: ${e.message}`);
  }

  try {
    const userSeed = [
      {
        openId: "seed-admin-manager",
        name: "Manager Seed",
        email: "manager.seed@senbonsplans.local",
        role: "user",
        staffRole: "manager",
        isActive: true,
      },
      {
        openId: "seed-admin-editor",
        name: "Editor Seed",
        email: "editor.seed@senbonsplans.local",
        role: "user",
        staffRole: "staff",
        isActive: true,
      },
      {
        openId: "seed-admin-disabled",
        name: "Disabled Seed",
        email: "disabled.seed@senbonsplans.local",
        role: "user",
        staffRole: "staff",
        isActive: false,
      },
    ];

    for (const user of userSeed) {
      await db.execute(sql`
        INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
        SELECT ${user.openId}, ${user.name}, ${user.email}, 'local_admin', ${user.role}, NOW(), NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM users u WHERE u.openId = ${user.openId}
        )
      `);

      await db.execute(sql`
        INSERT INTO staff_accounts (userId, role, permissions, isActive, createdAt, updatedAt)
        SELECT u.id, ${user.staffRole}, NULL, ${user.isActive}, NOW(), NOW()
        FROM users u
        WHERE u.openId = ${user.openId}
          AND NOT EXISTS (
            SELECT 1 FROM staff_accounts sa WHERE sa.userId = u.id
          )
      `);
    }
    console.log("  - Admin users and roles seeded");
  } catch (e) {
    console.log(`  - Admin user seed: ${e.message}`);
  }

  try {
    await db.execute(sql`
      INSERT INTO orders (
        orderNumber, customerName, customerPhone, customerAddress, customerCity,
        totalAmount, status, paymentMethod, paymentStatus, paymentReference, notes, userId, createdAt, updatedAt
      )
      SELECT 'SBP-SEED-1001', 'Awa Ndiaye', '+221770000111', 'Plateau, Dakar', 'Dakar',
        52000, 'delivered', 'wave', 'completed', 'seed-wave-1001', 'Seed paid order', NULL, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY
      WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.orderNumber = 'SBP-SEED-1001')
    `);

    await db.execute(sql`
      INSERT INTO orders (
        orderNumber, customerName, customerPhone, customerAddress, customerCity,
        totalAmount, status, paymentMethod, paymentStatus, paymentReference, notes, userId, createdAt, updatedAt
      )
      SELECT 'SBP-SEED-1002', 'Mamadou Fall', '+221770000222', 'Sacre Coeur, Dakar', 'Dakar',
        36000, 'processing', 'orange_money', 'failed', 'seed-om-1002', 'Seed failed payment', NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY
      WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.orderNumber = 'SBP-SEED-1002')
    `);

    await db.execute(sql`
      INSERT INTO orders (
        orderNumber, customerName, customerPhone, customerAddress, customerCity,
        totalAmount, status, paymentMethod, paymentStatus, paymentReference, notes, userId, createdAt, updatedAt
      )
      SELECT 'SBP-SEED-1003', 'Fatou Diop', '+221770000333', 'Almadies, Dakar', 'Dakar',
        28000, 'pending', 'cash', 'pending', NULL, 'Seed pending order', NULL, NOW() - INTERVAL 5 HOUR, NOW() - INTERVAL 5 HOUR
      WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.orderNumber = 'SBP-SEED-1003')
    `);

    await db.execute(sql`
      INSERT INTO order_items (orderId, productId, productName, productImage, quantity, unitPrice, totalPrice)
      SELECT o.id, p.id, p.name, p.imageUrl, 2, p.price, p.price * 2
      FROM orders o
      JOIN products p ON p.slug = 'ecouteurs-bluetooth'
      WHERE o.orderNumber = 'SBP-SEED-1001'
        AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.orderId = o.id)
      LIMIT 1
    `);

    await db.execute(sql`
      INSERT INTO order_items (orderId, productId, productName, productImage, quantity, unitPrice, totalPrice)
      SELECT o.id, p.id, p.name, p.imageUrl, 1, p.price, p.price
      FROM orders o
      JOIN products p ON p.slug = 'blender-multifonction'
      WHERE o.orderNumber = 'SBP-SEED-1002'
        AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.orderId = o.id)
      LIMIT 1
    `);

    await db.execute(sql`
      INSERT INTO order_items (orderId, productId, productName, productImage, quantity, unitPrice, totalPrice)
      SELECT o.id, p.id, p.name, p.imageUrl, 1, p.price, p.price
      FROM orders o
      JOIN products p ON p.slug = 'tapis-yoga'
      WHERE o.orderNumber = 'SBP-SEED-1003'
        AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.orderId = o.id)
      LIMIT 1
    `);

    await db.execute(sql`
      INSERT INTO analytics_events (type, sessionId, userId, path, meta, createdAt)
      SELECT 'page_view', 'seed-session-1001', NULL, '/boutique', '{"seed":true}', NOW() - INTERVAL 2 DAY
      WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events ae WHERE ae.sessionId = 'seed-session-1001' AND ae.type = 'page_view'
      )
    `);
    await db.execute(sql`
      INSERT INTO analytics_events (type, sessionId, userId, path, meta, createdAt)
      SELECT 'add_to_cart', 'seed-session-1001', NULL, '/produit/ecouteurs-bluetooth', '{"seed":true}', NOW() - INTERVAL 2 DAY
      WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events ae WHERE ae.sessionId = 'seed-session-1001' AND ae.type = 'add_to_cart'
      )
    `);
    await db.execute(sql`
      INSERT INTO analytics_events (type, sessionId, userId, path, meta, createdAt)
      SELECT 'purchase', 'seed-session-1001', NULL, '/commande', '{"orderNumber":"SBP-SEED-1001"}', NOW() - INTERVAL 2 DAY
      WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events ae WHERE ae.sessionId = 'seed-session-1001' AND ae.type = 'purchase'
      )
    `);
    await db.execute(sql`
      INSERT INTO analytics_events (type, sessionId, userId, path, meta, createdAt)
      SELECT 'page_view', 'seed-session-1002', NULL, '/boutique', '{"seed":true}', NOW() - INTERVAL 1 DAY
      WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events ae WHERE ae.sessionId = 'seed-session-1002' AND ae.type = 'page_view'
      )
    `);
    console.log("  - Orders and analytics seeded");
  } catch (e) {
    console.log(`  - Orders/analytics seed: ${e.message}`);
  }

  try {
    await db.execute(sql`
      INSERT INTO reviews (
        productId,
        customerName,
        customerEmail,
        rating,
        title,
        body,
        status,
        isVerifiedPurchase
      )
      SELECT
        p.id,
        'Aissatou N.',
        'aissatou.seed@senbonsplans.local',
        5,
        'Glow visible apres 10 jours',
        'Texture legere, aucune irritation et peau plus lumineuse.',
        'approved',
        false
      FROM products p
      WHERE (SELECT COUNT(*) FROM reviews r WHERE r.status = 'approved') < 2
      ORDER BY p.id ASC
      LIMIT 1
    `);
    await db.execute(sql`
      INSERT INTO reviews (
        productId,
        customerName,
        customerEmail,
        rating,
        title,
        body,
        status,
        isVerifiedPurchase
      )
      SELECT
        p.id,
        'Marieme S.',
        'marieme.seed@senbonsplans.local',
        4,
        'Routine simple et efficace',
        'Peau hydratee toute la journee, je recommande ce produit.',
        'approved',
        false
      FROM products p
      WHERE (SELECT COUNT(*) FROM reviews r WHERE r.status = 'approved') < 2
      ORDER BY p.id ASC
      LIMIT 1 OFFSET 1
    `);
    await db.execute(sql`
      INSERT INTO reviews (
        productId,
        customerName,
        customerEmail,
        rating,
        title,
        body,
        status,
        isVerifiedPurchase
      )
      SELECT
        p.id,
        'Ibrahima T.',
        'ibrahima.pending@senbonsplans.local',
        4,
        'Bon potentiel',
        'Je teste encore la routine, resultat encourageant.',
        'pending',
        false
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM reviews r WHERE r.customerEmail = 'ibrahima.pending@senbonsplans.local'
      )
      ORDER BY p.id ASC
      LIMIT 1
    `);
    await db.execute(sql`
      INSERT INTO reviews (
        productId,
        customerName,
        customerEmail,
        rating,
        title,
        body,
        status,
        isVerifiedPurchase
      )
      SELECT
        p.id,
        'Coumba P.',
        'coumba.hidden@senbonsplans.local',
        2,
        'Pas adapte a ma peau',
        'J ai eu une reaction et j ai arrete le produit.',
        'rejected',
        false
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM reviews r WHERE r.customerEmail = 'coumba.hidden@senbonsplans.local'
      )
      ORDER BY p.id DESC
      LIMIT 1
    `);
    console.log("  - Sample reviews inserted");
  } catch (e) {
    console.log(`  - Sample reviews: ${e.message}`);
  }

  try {
    await db.execute(sql`
      INSERT INTO audit_logs (actorUserId, action, entityType, entityId, beforeJson, afterJson, ip, userAgent, createdAt)
      SELECT u.id, 'seed.bootstrap', 'system', 'seed', NULL, '{"status":"ok"}', '127.0.0.1', 'seed.mjs', NOW()
      FROM users u
      WHERE u.openId = 'seed-admin-manager'
        AND NOT EXISTS (
          SELECT 1 FROM audit_logs al WHERE al.action = 'seed.bootstrap'
        )
      LIMIT 1
    `);
    console.log("  - Audit logs seeded");
  } catch (e) {
    console.log(`  - Audit log seed: ${e.message}`);
  }

  try {
    const kbRows = [
      {
        title: "Delais de livraison Dakar",
        content: "Dakar centre est livre en 24h. Banlieue et regions proches: 24h a 48h.",
        tags: '["shipping","dakar","delivery"]',
      },
      {
        title: "Frais de livraison",
        content: "Les frais varient selon la zone. Demandez votre quartier pour un tarif exact.",
        tags: '["shipping","fees","zones"]',
      },
      {
        title: "Modes de paiement",
        content: "Paiement via Wave, Orange Money, Free Money, et carte selon disponibilite.",
        tags: '["payments","wave","orange-money"]',
      },
      {
        title: "Politique de retour",
        content: "Les retours sont traites par le support selon le delai et l'etat du produit.",
        tags: '["returns","policy"]',
      },
      {
        title: "Routine peau grasse",
        content: "Nettoyant doux, serum niacinamide, hydratant leger, SPF le matin.",
        tags: '["routine","oily-skin","niacinamide"]',
      },
      {
        title: "Routine anti-taches",
        content: "Vitamine C le matin, SPF quotidien, acide doux le soir 2 a 3 fois/semaine.",
        tags: '["routine","dark-spots","vitamin-c","spf"]',
      },
      {
        title: "Suivi de commande",
        content: "Partagez le numero de commande (SBP-1234) ou le numero de telephone.",
        tags: '["order","tracking","support"]',
      },
      {
        title: "Conseils securite peau sensible",
        content: "Testez d'abord sur une petite zone et consultez un pharmacien en cas de reaction.",
        tags: '["sensitive-skin","safety","routine"]',
      },
    ];

    for (const row of kbRows) {
      await db.execute(sql`
        INSERT INTO chat_kb_articles (title, content, tags, locale, isPublished)
        SELECT ${row.title}, ${row.content}, ${row.tags}, 'fr-SN', true
        WHERE NOT EXISTS (
          SELECT 1 FROM chat_kb_articles WHERE title = ${row.title}
        )
      `);
    }

    await db.execute(sql`
      INSERT INTO chat_threads (id, visitorId, status, createdAt, updatedAt)
      SELECT 10001, 'demo-visitor-1', 'open', NOW() - INTERVAL 90 MINUTE, NOW() - INTERVAL 12 MINUTE
      WHERE NOT EXISTS (SELECT 1 FROM chat_threads)
    `);
    await db.execute(sql`
      INSERT INTO chat_threads (id, visitorId, status, createdAt, updatedAt)
      SELECT 10002, 'demo-visitor-2', 'closed', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 40 MINUTE
      WHERE NOT EXISTS (SELECT 1 FROM chat_threads WHERE id = 10002)
    `);

    await db.execute(sql`
      INSERT INTO chat_messages (threadId, role, content, meta, sessionId, customerName, customerEmail, message, isFromCustomer)
      SELECT
        10001,
        'assistant',
        'Bonjour, je peux vous aider avec une routine, un suivi de commande ou la livraison.',
        '{"kind":"welcome"}',
        '10001',
        'Assistant',
        'chat@local',
        'Bonjour, je peux vous aider avec une routine, un suivi de commande ou la livraison.',
        false
      WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE threadId = 10001)
    `);
    await db.execute(sql`
      INSERT INTO chat_messages (threadId, role, content, meta, sessionId, customerName, customerEmail, message, isFromCustomer)
      SELECT
        10001,
        'user',
        'Je cherche une routine anti-taches.',
        '{}',
        '10001',
        'Customer',
        'chat@local',
        'Je cherche une routine anti-taches.',
        true
      WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE threadId = 10001 AND role = 'user')
    `);
    await db.execute(sql`
      INSERT INTO chat_messages (threadId, role, content, meta, sessionId, customerName, customerEmail, message, isFromCustomer)
      SELECT
        10002,
        'user',
        'Ou est ma commande SBP-2091 ?',
        '{}',
        '10002',
        'Customer',
        'chat@local',
        'Ou est ma commande SBP-2091 ?',
        true
      WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE threadId = 10002)
    `);
    await db.execute(sql`
      INSERT INTO chat_tickets (threadId, message, phone, status)
      SELECT 10002, 'Client veut confirmation horaire de livraison.', '+221770001122', 'open'
      WHERE NOT EXISTS (SELECT 1 FROM chat_tickets WHERE threadId = 10002)
    `);

    console.log("  - Chatbot seed data inserted");
  } catch (e) {
    console.log(`  - Chatbot seed data: ${e.message}`);
  }

  console.log("\nSeeding complete!");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });


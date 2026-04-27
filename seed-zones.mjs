import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const deliveryZones = [
  {
    name: 'Dakar Centre',
    slug: 'dakar-centre',
    description: 'Livraison dans le centre-ville de Dakar',
    deliveryFee: 2000,
    deliveryDays: 1,
    displayOrder: 1,
  },
  {
    name: 'Banlieue de Dakar',
    slug: 'banlieue-dakar',
    description: 'Livraison dans la banlieue de Dakar (Pikine, Guédiawaye, etc.)',
    deliveryFee: 3000,
    deliveryDays: 2,
    displayOrder: 2,
  },
  {
    name: 'Région de Dakar',
    slug: 'region-dakar',
    description: 'Livraison dans la région de Dakar (Rufisque, Bargny, etc.)',
    deliveryFee: 5000,
    deliveryDays: 2,
    displayOrder: 3,
  },
  {
    name: 'Région de Thiès',
    slug: 'region-thies',
    description: 'Livraison dans la région de Thiès',
    deliveryFee: 8000,
    deliveryDays: 3,
    displayOrder: 4,
  },
  {
    name: 'Région de Kaolack',
    slug: 'region-kaolack',
    description: 'Livraison dans la région de Kaolack',
    deliveryFee: 10000,
    deliveryDays: 3,
    displayOrder: 5,
  },
  {
    name: 'Région de Saint-Louis',
    slug: 'region-saint-louis',
    description: 'Livraison dans la région de Saint-Louis',
    deliveryFee: 12000,
    deliveryDays: 4,
    displayOrder: 6,
  },
];

console.log('🌱 Seeding delivery zones...');

for (const zone of deliveryZones) {
  await connection.execute(
    `INSERT INTO delivery_zones (name, slug, description, deliveryFee, deliveryDays, isActive, displayOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [zone.name, zone.slug, zone.description, zone.deliveryFee, zone.deliveryDays, true, zone.displayOrder]
  );
  console.log(`✅ Created zone: ${zone.name}`);
}

await connection.end();
console.log('✨ Delivery zones seeded successfully!');

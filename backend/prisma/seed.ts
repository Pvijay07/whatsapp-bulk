import { PrismaClient, OrgStatus, UserRole, NumberStatus, WhatsAppAccountStatus, TemplateStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial SaaS database...');

  // 1. Create Demo Organization
  const demoOrg = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Enterprises India',
      status: OrgStatus.ACTIVE,
    },
  });

  // 2. Create Demo Owner User
  const passwordHash = await bcrypt.hash('DemoPassword123!', 10);
  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: demoOrg.id,
        email: 'admin@demoenterprise.in',
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      email: 'admin@demoenterprise.in',
      passwordHash,
      role: UserRole.OWNER,
    },
  });

  // 3. Create Pre-funded Wallet (₹5,000 = 500,000 paise)
  await prisma.wallet.upsert({
    where: { organizationId: demoOrg.id },
    update: {},
    create: {
      organizationId: demoOrg.id,
      currency: 'INR',
      balancePaise: 500000n, // ₹5,000.00
      reservedPaise: 0n,
    },
  });

  // 4. Create Sample Virtual Number (+91 80 4567 8901)
  const virtualNumber = await prisma.virtualNumber.create({
    data: {
      organizationId: demoOrg.id,
      provider: 'exotel',
      providerNumberId: 'demo-exo-08045678901',
      phoneNumber: '+918045678901',
      countryCode: '+91',
      status: NumberStatus.ALLOCATED,
      capabilities: { voice: true, sms: false, whatsappEligible: true },
    },
  });

  // 5. Connect WhatsApp Account
  await prisma.whatsAppAccount.create({
    data: {
      organizationId: demoOrg.id,
      virtualNumberId: virtualNumber.id,
      provider: 'meta_cloud',
      externalAccountId: '109283746501928',
      displayNumber: '+918045678901',
      status: WhatsAppAccountStatus.CONNECTED,
    },
  });

  // 6. Create Sample Approved WhatsApp Template
  await prisma.messageTemplate.create({
    data: {
      organizationId: demoOrg.id,
      name: 'diwali_special_offer',
      category: 'MARKETING',
      language: 'en_US',
      status: TemplateStatus.APPROVED,
      components: [
        {
          type: 'HEADER',
          format: 'TEXT',
          text: 'Exclusive Diwali Offer!',
        },
        {
          type: 'BODY',
          text: 'Hello {{1}}, get 20% off on your next purchase with code FESTIVE20.',
        },
      ],
    },
  });

  console.log('Seeding completed successfully!');
  console.log('Demo Org ID: 00000000-0000-0000-0000-000000000001');
  console.log('Demo User: admin@demoenterprise.in / DemoPassword123!');
  console.log('Demo Number: +918045678901');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

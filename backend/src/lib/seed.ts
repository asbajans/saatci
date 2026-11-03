import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const DEFAULT_PAYMENT_METHODS = ['Nakit', 'Kredi Kartı', 'Havale / EFT'];

async function ensurePaymentMethods() {
  for (const name of DEFAULT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function ensureInitialAdmin() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || 'Klinik Yöneticisi';

  if (!email || !password) {
    console.log('[bootstrap] Kullanıcı yok. İlk yönetici hesabı web arayüzündeki kurulum ekranından oluşturulacak.');
    return;
  }

  if (password.length < 8) {
    throw new Error('INITIAL_ADMIN_PASSWORD en az 8 karakter olmalıdır');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, password: passwordHash, role: 'ADMIN' },
  });
  console.log(`[bootstrap] İlk yönetici hesabı oluşturuldu: ${email}`);
}

export async function bootstrapDatabase() {
  await ensurePaymentMethods();
  await ensureInitialAdmin();
}

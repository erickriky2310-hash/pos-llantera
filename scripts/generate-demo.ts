import 'fake-indexeddb/auto';
import { writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { Database, DexieRepository, makeLine, today, validateBackup } from '../src/data.ts';
import type { Contact, Product } from '../src/data.ts';

const database = new Database('generador-demo-en-memoria');
const repository = new DexieRepository(database, false);
const date = today();
const supplier: Contact = {
  id: 'demo-proveedor', name: 'Distribuidora Ejemplo', phone: '',
  rfc: '', address: '', profile: 'perfil-b',
};
const customer: Contact = {
  id: 'demo-cliente', name: 'Flotilla Ejemplo', phone: '', rfc: '', address: '',
};
const product: Product = {
  id: 'demo-producto', sku: 'DEMO-001', name: 'Llanta de demostración',
  size: '295/80 R22.5', brand: 'Marca Ejemplo', position: 'Dirección',
  plies: '16', supplierId: supplier.id, cost: 410000, price: 430000,
  stock: 0, minimum: 0, vehicle: 'truck', brandClass: 'china', inventoryMode: 'external',
};

try {
  await repository.initialize();
  await repository.saveContact('suppliers', supplier);
  await repository.saveContact('customers', customer);
  await repository.saveProduct(product);
  const quote = await repository.saveQuote({
    customerId: customer.id, dueDate: date, suppliedBy: supplier.name,
    suppliedBySupplierId: supplier.id, notes: 'Operación ficticia de demostración',
    options: [{ id: 'demo-opcion', name: 'Opción de demostración', lines: [makeLine(product, supplier, product.cost, 2)] }],
  });
  const order = await repository.convert(quote);
  const sale = await repository.convert(order);
  const invoice = { id: 'demo-factura', saleId: sale, number: 'DEMO-FAC-001', amount: 860000, date, dueDate: date };
  await repository.saveInvoice(invoice);
  for (const [index, amount] of [300000, 560000].entries()) {
    const paymentId = 'demo-abono-' + (index + 1);
    await repository.savePayment({
      id: paymentId, saleId: sale, amount, date, depositDate: date, confirmedAt: '',
      method: 'Transferencia', reference: paymentId, status: 'pending',
      allocations: [{ invoiceId: invoice.id, amount }],
    });
    await repository.changePayment(paymentId, 'confirmed', date, 'Confirmación ficticia');
  }
  await repository.settle(sale, supplier.id, date, 'DEMO-COM-001', 60000, 'Transferencia');
  const backup = { format: 'pos-llantera', version: 3, data: await repository.backup() };
  validateBackup(backup);
  await mkdir('demo', { recursive: true });
  await writeFile('demo/datos-ficticios.json', JSON.stringify(backup, null, 2) + '\n');
  console.log('Demo generada en demo/datos-ficticios.json');
} finally {
  await database.delete();
}

/**
 * Fix the OrthiEpanalipsiModal component
 */
import fs from 'fs';

const filePath = 'client/src/components/documents/orthi-epanalipsi-modal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the component export
content = content.replace(
  `export function OrthiEpanalipsiModal({ isOpen, onClose, document }: OrthiEpanalipsiModalProps) {`,
  `export function OrthiEpanalipsiModal({ isOpen, onClose, document }: OrthiEpanalipsiModalProps): JSX.Element {`
);

// Fix the recipient schema to include fathername
content = content.replace(
  `const recipientSchema = z.object({
  firstname: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  afm: z.string().min(9, "Το ΑΦΜ πρέπει να είναι 9 ψηφία").max(9, "Το ΑΦΜ πρέπει να είναι 9 ψηφία"),
  amount: z.number().min(0.01, "Το ποσό πρέπει να είναι θετικό"),
  installment: z.number().int().min(1, "Η δόση πρέπει να είναι τουλάχιστον 1"),
});`,
  `const recipientSchema = z.object({
  firstname: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  fathername: z.string().optional(),
  afm: z.string().min(9, "Το ΑΦΜ πρέπει να είναι 9 ψηφία").max(9, "Το ΑΦΜ πρέπει να είναι 9 ψηφία"),
  amount: z.number().min(0.01, "Το ποσό πρέπει να είναι θετικό"),
  installment: z.number().int().min(1, "Η δόση πρέπει να είναι τουλάχιστον 1"),
});`
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content);
console.log('Fixed orthi-epanalipsi-modal.tsx');
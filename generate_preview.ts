import { generateDailySummaryEmail } from './src/lib/email';
import * as fs from 'fs';
import * as path from 'path';

const mockData = {
    date: new Date().toISOString(),
    stats: {
        total_calls: 156,
        total_dentists: 140,
        interested: 12,
        not_interested: 45,
        no_answer: 30,
        callback: 65,
        order_taken: 4
    },
    callers: [
        {
            caller_name: 'Иван Иванов',
            total_calls: 82,
            interested: 7,
            not_interested: 24,
            no_answer: 16,
            callback: 32,
            order_taken: 3,
            summary_notes: 'Днес имаше много добри резултати в регион София. Няколко лекари поискаха допълнителна информация за имплантите.\n\nЗабелязах, че сутринта се свързвам по-лесно, докато следобед повечето са в кабинет.'
        },
        {
            caller_name: 'Мария Георгиева',
            total_calls: 74,
            interested: 5,
            not_interested: 21,
            no_answer: 14,
            callback: 33,
            order_taken: 1,
            summary_notes: null
        }
    ],
    logs: [
        '⚠️ 12 обаждания за преобаждане все още чакат',
        'ℹ️ Системен бекъп създаден успешно (24 MB)'
    ]
};

const result = generateDailySummaryEmail(mockData);
const outputPath = path.resolve(process.env.PWD || process.cwd(), 'email_preview.html');
fs.writeFileSync(outputPath, result.html);
console.log(outputPath);

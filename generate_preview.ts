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
    summaries: [
        {
            caller_name: 'Иван Иванов',
            call_count: 82,
            summary_notes: 'Днес имаше много добри резултати в регион София. Няколко лекари поискаха допълнителна информация за имплантите.\n\nЗабелязах, че сутринта се свързвам по-лесно, докато следобед повечето са в кабинет.'
        },
        {
            caller_name: 'Мария Георгиева',
            call_count: 74,
            summary_notes: 'Покрих регионите Пловдив и Варна.\nДвама лекари от Пловдив поискаха среща следващата седмица. Във Варна имаше доста невърнати обаждания, ще ги прехвърля за понеделник.'
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

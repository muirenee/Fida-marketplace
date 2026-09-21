import {prisma} from '@fida/database/client';
import {saveRuntimeSettings} from '../lib/public-config.js';
try{console.log(JSON.stringify({normalizedRecords:await saveRuntimeSettings({})}));}finally{await prisma.$disconnect();}

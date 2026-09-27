const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/base.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import {\n  collection, doc, getDoc, getDocs, addDoc, updateDoc,\n  serverTimestamp, query, where, onSnapshot, increment,\n} from 'firebase/firestore';",
  "import {\n  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,\n  serverTimestamp, query, where, onSnapshot, increment,\n} from 'firebase/firestore';"
);

const deleteFunc = `export async function deleteRecord(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(\`Error deleting \${collectionName}:\`, error);
  }
}

export async function restoreRecord`;

content = content.replace('export async function restoreRecord', deleteFunc);
fs.writeFileSync(path, content, 'utf8');

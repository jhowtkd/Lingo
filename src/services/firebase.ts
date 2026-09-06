import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  increment,
  writeBatch,
  limit,
} from 'firebase/firestore';
import {
  UserProfile,
  UserRole,
  SharedKnowledgePack,
  GraphNode,
  GraphRelation,
  StudyMaterialItem,
  UserStats,
  ChatMessage,
  ChatConversation,
  PedagogicalCorrection,
  FrequentErrorItem,
} from '../types';
import { reassembleChunkedCollection, type ChunkDocEntry } from './chunkAssembly';

// Configuração do Firebase
const firebaseConfig = {
  projectId: 'gn-coach',
  appId: '1:770421276660:web:c850bea18148f11894c3a1',
  apiKey: 'AIzaSyCoVPhEijqJSdJVpTzVguWSkNRvzoBHuXE',
  authDomain: 'gn-coach.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-lingo-a1b5e309-2d70-4a0a-b2cd-7fbe43f4e81d',
  storageBucket: 'gn-coach.firebasestorage.app',
  messagingSenderId: '770421276660',
  oAuthClientId: '770421276660-tpmts8eu32qcjc1qivas9dabaceq95k5.apps.googleusercontent.com',
};

// Inicialização segura do Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Lista de e-mails com permissão de administrador padrão
const ADMIN_EMAILS = [
  'jhonatan.marcela@gmail.com',
  'admin@lingo.app',
  'adm@lingo.com',
];

/**
 * Cria ou atualiza o perfil do usuário no Firestore
 */
export async function syncUserProfile(
  user: FirebaseUser,
  forceRole?: UserRole
): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  const emailLower = (user.email || '').toLowerCase();
  const isAdminEmail = ADMIN_EMAILS.includes(emailLower);

  let role: UserRole = forceRole || (isAdminEmail ? 'admin' : 'user');

  if (userSnap.exists()) {
    const existingData = userSnap.data() as UserProfile;
    // Preserva o papel se já foi promovido pelo painel de admin
    if (existingData.role) {
      role = forceRole || existingData.role;
    }

    const updatedProfile: UserProfile = {
      ...existingData,
      uid: user.uid,
      email: user.email || existingData.email || 'anonimo@lingo.local',
      displayName: user.displayName || existingData.displayName || 'Estudante',
      photoURL: user.photoURL || existingData.photoURL || '',
      role: role,
      lastLoginAt: new Date().toISOString(),
      isAnonymous: user.isAnonymous,
    };

    // Escrita de lastLoginAt em segundo plano: não deve prender o callback de
    // auth esperando uma rede lenta a cada abertura do app.
    void setDoc(userRef, updatedProfile, { merge: true }).catch((err) =>
      console.warn('Erro ao atualizar perfil:', err)
    );
    return updatedProfile;
  }

  // Novo usuário
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email || (user.isAnonymous ? `convidado_${user.uid.slice(0, 5)}@lingo.local` : ''),
    displayName: user.displayName || (user.isAnonymous ? 'Visitante Convidado' : 'Estudante'),
    photoURL: user.photoURL || '',
    role: role,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isAnonymous: user.isAnonymous,
    statsSummary: {
      level: 1,
      xp: 0,
      streak: 1,
      nodesCount: 0,
      materialsCount: 0,
    },
  };

  await setDoc(userRef, newProfile);
  return newProfile;
}

/**
 * Login com Google Popup
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return await syncUserProfile(result.user);
}

/**
 * Login com E-mail e Senha
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserProfile> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return await syncUserProfile(result.user);
}

/**
 * Cadastro com E-mail e Senha
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName: string
): Promise<UserProfile> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName });
  }
  return await syncUserProfile(result.user);
}

/**
 * Login como Convidado (Anônimo)
 */
export async function signInAsGuest(guestName = 'Estudante Visitante'): Promise<UserProfile> {
  const result = await signInAnonymously(auth);
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: guestName });
  }
  return await syncUserProfile(result.user);
}

/**
 * Logout
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Observa mudanças de estado de autenticação
 */
export function onAuthChange(callback: (user: UserProfile | null) => void) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const profile = await syncUserProfile(firebaseUser);
        callback(profile);
      } catch (err) {
        console.warn('Erro ao sincronizar perfil do usuário:', err);
        // Fallback para perfil local temporário
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Estudante',
          photoURL: firebaseUser.photoURL || '',
          role: ADMIN_EMAILS.includes((firebaseUser.email || '').toLowerCase()) ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isAnonymous: firebaseUser.isAnonymous,
        });
      }
    } else {
      callback(null);
    }
  });
}

/**
 * Busca todos os usuários cadastrados (Exclusivo para Administradores)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(query(usersCol, orderBy('createdAt', 'desc'), limit(100)));
    const users: UserProfile[] = [];
    snap.forEach((doc) => {
      users.push(doc.data() as UserProfile);
    });
    return users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    return [];
  }
}

/**
 * Atualiza o cargo de um usuário (Admin / Aluno)
 */
export async function updateUserRole(uid: string, newRole: UserRole): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role: newRole });
}

/**
 * Atualiza o resumo de métricas do usuário no perfil
 */
export async function updateUserStatsSummary(
  uid: string,
  summary: { level: number; xp: number; streak: number; nodesCount: number; materialsCount: number }
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { statsSummary: summary, lastLoginAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Erro ao atualizar resumo do usuário:', err);
  }
}

// --------------------------------------------------------------------------
// SINCRONIZAÇÃO DE BASE DE CONHECIMENTO PESSOAL (ISOLADA POR USUÁRIO)
// --------------------------------------------------------------------------

export interface UserPersonalKnowledgeBase {
  nodes: GraphNode[];
  relations: GraphRelation[];
  materials: StudyMaterialItem[];
  stats: UserStats;
  corrections: PedagogicalCorrection[];
  chatHistory: ChatMessage[];
  conversations?: ChatConversation[];
}

/**
 * Resultado do download da base pessoal: os dados por coleção junto dos
 * carimbos `updatedAt` gravados na nuvem, usados para decidir se o dado
 * remoto é mais novo que o local antes de hidratar.
 */
export interface FetchedKnowledgeBase {
  data: Partial<UserPersonalKnowledgeBase>;
  updatedAt: Partial<
    Record<
      'stats' | 'nodes' | 'relations' | 'materials' | 'corrections' | 'conversations',
      string
    >
  >;
}

// Tamanho máximo de itens por doc de chunk: mantém cada documento bem abaixo
// do teto de 1 MB por documento imposto pelo Firestore.
const KB_CHUNK_SIZE = 250;

type ChunkableCollection =
  | 'nodes'
  | 'relations'
  | 'materials'
  | 'corrections'
  | 'conversations';

/**
 * Escreve uma coleção grande em múltiplos docs (chunks) para respeitar o teto
 * de 1 MB por documento do Firestore, apagando chunks excedentes da escrita
 * anterior. Coleções pequenas continuam em 1 doc compatível com o formato
 * legado ({ items, updatedAt }).
 */
function writeChunkedCollection(
  batch: ReturnType<typeof writeBatch>,
  userId: string,
  name: ChunkableCollection,
  items: unknown[],
  updatedAt: string,
  previousChunkCount: number
): number {
  const totalChunks = Math.max(1, Math.ceil(items.length / KB_CHUNK_SIZE));
  for (let i = 0; i < totalChunks; i++) {
    batch.set(doc(db, 'users', userId, 'knowledge_base', `${name}_${i}`), {
      items: items.slice(i * KB_CHUNK_SIZE, (i + 1) * KB_CHUNK_SIZE),
      chunkIndex: i,
      totalChunks,
      updatedAt,
    });
  }
  for (let i = totalChunks; i < previousChunkCount; i++) {
    batch.delete(doc(db, 'users', userId, 'knowledge_base', `${name}_${i}`));
  }
  return totalChunks;
}

/**
 * Salva a base pessoal do usuário no Firestore. Coleções de arrays são gravadas
 * em chunks (`{colecao}_{i}`) e a contagem de chunks por coleção é devolvida
 * para o chamador persistir (setCloudChunkCount) e reutilizar na próxima
 * escrita, permitindo apagar chunks que sobraram quando a coleção encolhe.
 */
export async function syncPersonalKnowledgeToCloud(
  userId: string,
  data: Partial<UserPersonalKnowledgeBase>,
  previousChunkCounts: Partial<Record<ChunkableCollection, number>> = {}
): Promise<Partial<Record<ChunkableCollection, number>>> {
  if (!userId) return {};

  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const chunkCounts: Partial<Record<ChunkableCollection, number>> = {};

  if (data.stats) {
    batch.set(
      doc(db, 'users', userId, 'knowledge_base', 'stats'),
      { ...data.stats, updatedAt: now },
      { merge: true }
    );
  }
  if (data.materials) {
    chunkCounts.materials = writeChunkedCollection(
      batch,
      userId,
      'materials',
      data.materials,
      now,
      previousChunkCounts.materials ?? 0
    );
  }
  if (data.nodes) {
    chunkCounts.nodes = writeChunkedCollection(
      batch,
      userId,
      'nodes',
      data.nodes,
      now,
      previousChunkCounts.nodes ?? 0
    );
  }
  if (data.relations) {
    chunkCounts.relations = writeChunkedCollection(
      batch,
      userId,
      'relations',
      data.relations,
      now,
      previousChunkCounts.relations ?? 0
    );
  }
  if (data.corrections) {
    chunkCounts.corrections = writeChunkedCollection(
      batch,
      userId,
      'corrections',
      data.corrections,
      now,
      previousChunkCounts.corrections ?? 0
    );
  }
  if (data.conversations) {
    chunkCounts.conversations = writeChunkedCollection(
      batch,
      userId,
      'conversations',
      data.conversations,
      now,
      previousChunkCounts.conversations ?? 0
    );
  }

  try {
    await batch.commit();
  } catch (err) {
    // Registra e repropaga: o chamador (scheduleCloudSync) já tem try/catch e
    // a Task 8 emitirá o evento de saúde a partir daqui.
    console.warn('Erro ao sincronizar base pessoal com o Firestore:', err);
    throw err;
  }
  return chunkCounts;
}

/**
 * Baixa a base pessoal do usuário do Firestore
 */
export async function fetchPersonalKnowledgeFromCloud(
  userId: string
): Promise<FetchedKnowledgeBase | null> {
  if (!userId) return null;

  try {
    const data: Partial<UserPersonalKnowledgeBase> = {};
    const updatedAt: FetchedKnowledgeBase['updatedAt'] = {};

    // Docs de chunk (`{colecao}_{i}`) são acumulados e remontados depois via
    // reassembleChunkedCollection, que considera apenas a geração mais recente
    // (chunks órfãos de gerações antigas — deixados por outro dispositivo com
    // contagem desatualizada — não são misturados na remontagem). Um chunk só
    // existe se foi gravado, então a presença de chunks sobrepõe o doc legado
    // da mesma coleção — mesmo que a remontagem resulte em zero itens.
    const chunkEntries: ChunkDocEntry[] = [];

    const kbCol = collection(db, 'users', userId, 'knowledge_base');
    const snap = await getDocs(kbCol);
    snap.forEach((entry) => {
      const payload = entry.data() as Record<string, any>;
      const match = entry.id.match(
        /^(nodes|relations|materials|corrections|conversations)_(\d+)$/
      );
      if (match) {
        chunkEntries.push({ id: entry.id, data: payload });
        return;
      }
      const cloudStamp =
        typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined;
      switch (entry.id) {
        case 'stats': {
          // Remove o carimbo antes de devolver: stats não tem esse campo no tipo.
          const { updatedAt: _drop, ...stats } = payload;
          data.stats = stats as UserStats;
          updatedAt.stats = cloudStamp;
          break;
        }
        case 'materials':
          if (payload.items) {
            data.materials = payload.items;
            updatedAt.materials = cloudStamp;
          }
          break;
        case 'nodes':
          if (payload.items) {
            data.nodes = payload.items;
            updatedAt.nodes = cloudStamp;
          }
          break;
        case 'relations':
          if (payload.items) {
            data.relations = payload.items;
            updatedAt.relations = cloudStamp;
          }
          break;
        case 'corrections':
          if (payload.items) {
            data.corrections = payload.items;
            updatedAt.corrections = cloudStamp;
          }
          break;
      }
    });

    // Remonta cada coleção chunkada na geração mais recente (ordem de índice
    // dentro da geração). `items: null` significa "nenhum chunk da coleção":
    // mantemos então o doc legado lido no switch acima, se houver.
    const chunkable: ChunkableCollection[] = [
      'nodes',
      'relations',
      'materials',
      'corrections',
      'conversations',
    ];
    for (const col of chunkable) {
      const reassembled = reassembleChunkedCollection(col, chunkEntries);
      if (reassembled.items !== null) {
        (data as Record<string, unknown>)[col] = reassembled.items;
        if (reassembled.updatedAt) updatedAt[col] = reassembled.updatedAt;
      }
    }

    return { data, updatedAt };
  } catch (err) {
    console.warn('Erro ao baixar base pessoal da nuvem:', err);
    return null;
  }
}

// --------------------------------------------------------------------------
// PACOTES DE CONHECIMENTO COMPARTILHADOS (CURADORIA ADM & COMUNIDADE)
// --------------------------------------------------------------------------

/**
 * Busca pacotes de conhecimento compartilhados
 */
export async function getSharedKnowledgePacks(): Promise<SharedKnowledgePack[]> {
  try {
    const col = collection(db, 'shared_knowledge_packs');
    const snap = await getDocs(query(col, orderBy('publicado_em', 'desc'), limit(50)));
    const packs: SharedKnowledgePack[] = [];
    snap.forEach((doc) => {
      packs.push(doc.data() as SharedKnowledgePack);
    });
    return packs.sort((a, b) => (b.publicado_em || '').localeCompare(a.publicado_em || ''));
  } catch (err) {
    console.warn('Erro ao buscar pacotes compartilhados:', err);
    return [];
  }
}

/**
 * Publica ou atualiza um pacote de conhecimento compartilhado
 */
export async function publishSharedKnowledgePack(
  pack: Partial<SharedKnowledgePack> & {
    titulo: string;
    idioma: string;
    autor_nome: string;
    autor_id: string;
  }
): Promise<string> {
  const packId = pack.id || `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullPack: SharedKnowledgePack = {
    id: packId,
    titulo: pack.titulo,
    descricao: pack.descricao || '',
    idioma: pack.idioma,
    nivel_cefr: pack.nivel_cefr || 'B1',
    autor_nome: pack.autor_nome,
    autor_id: pack.autor_id,
    publicado_em: pack.publicado_em || new Date().toISOString(),
    total_termos: pack.total_termos ?? (pack.dados_pack?.nodes?.length || 0),
    total_materiais: pack.total_materiais ?? (pack.dados_pack?.materials?.length || 0),
    clones_count: pack.clones_count || 0,
    dados_pack: pack.dados_pack || {
      nodes: [],
      relations: [],
      materials: [],
    },
  };
  const packRef = doc(db, 'shared_knowledge_packs', packId);
  await setDoc(packRef, fullPack);
  return packId;
}

/**
 * Incrementa contador de clones / downloads de um pacote compartilhado
 */
export async function incrementPackClones(packId: string): Promise<void> {
  try {
    const packRef = doc(db, 'shared_knowledge_packs', packId);
    await updateDoc(packRef, {
      clones_count: increment(1),
    });
  } catch (err) {
    console.warn('Erro ao incrementar clones do pacote:', err);
  }
}

/**
 * Remove um pacote compartilhado
 */
export async function deleteSharedKnowledgePack(packId: string): Promise<void> {
  const packRef = doc(db, 'shared_knowledge_packs', packId);
  await deleteDoc(packRef);
}

// --------------------------------------------------------------------------
// ERROS FREQUENTES & DIAGNÓSTICOS PEDAGÓGICOS (FIRESTORE)
// --------------------------------------------------------------------------

/**
 * Salva automaticamente uma correção gramatical/fonética na lista de Erros Frequentes do Firestore
 */
export async function saveFrequentErrorToCloud(
  errorData: Partial<FrequentErrorItem> & {
    userId: string;
    conceito: string;
    erro: string;
    explicacao: string;
    resposta_corrigida: string;
  }
): Promise<string> {
  try {
    const errorId =
      errorData.id ||
      `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullError: FrequentErrorItem = {
      id: errorId,
      userId: errorData.userId,
      userEmail: errorData.userEmail || auth.currentUser?.email || '',
      userName: errorData.userName || auth.currentUser?.displayName || 'Estudante',
      conceito: errorData.conceito,
      erro: errorData.erro,
      explicacao: errorData.explicacao,
      resposta_corrigida: errorData.resposta_corrigida,
      gravidade: errorData.gravidade || 'moderada',
      evidencia: errorData.evidencia || '',
      topico: errorData.topico || 'Geral',
      categoria: errorData.categoria || 'gramatica',
      ocorrencias: errorData.ocorrencias || 1,
      data: errorData.data || new Date().toISOString(),
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'frequent_errors', errorId), fullError, { merge: true });
    if (errorData.userId) {
      batch.set(doc(db, 'users', errorData.userId, 'frequent_errors', errorId), fullError, {
        merge: true,
      });
    }
    await batch.commit();

    return errorId;
  } catch (err) {
    console.warn('Erro ao salvar erro frequente no Firestore:', err);
    return '';
  }
}

/**
 * Busca a lista de Erros Frequentes do Firestore
 */
export async function getFrequentErrors(userId?: string): Promise<FrequentErrorItem[]> {
  try {
    const errCol = collection(db, 'frequent_errors');
    // Limita a leitura (where+orderBy juntos exigiriam índice composto;
    // mantemos o sort no cliente sobre um conjunto limitado).
    const q = userId
      ? query(errCol, where('userId', '==', userId), limit(200))
      : query(errCol, orderBy('data', 'desc'), limit(200));
    const snap = await getDocs(q);
    const errors: FrequentErrorItem[] = [];
    snap.forEach((doc) => {
      errors.push(doc.data() as FrequentErrorItem);
    });
    return errors.sort((a, b) => (b.data || b.criado_em || '').localeCompare(a.data || a.criado_em || ''));
  } catch (err) {
    console.warn('Erro ao buscar erros frequentes:', err);
    return [];
  }
}

/**
 * Exclui um registro de erro frequente do Firestore
 */
export async function deleteFrequentError(errorId: string, userId?: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'frequent_errors', errorId));
    if (userId) {
      batch.delete(doc(db, 'users', userId, 'frequent_errors', errorId));
    }
    await batch.commit();
  } catch (err) {
    console.warn('Erro ao deletar erro frequente:', err);
  }
}


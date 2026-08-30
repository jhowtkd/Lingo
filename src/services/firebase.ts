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
  PedagogicalCorrection,
  FrequentErrorItem,
} from '../types';

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

    await setDoc(userRef, updatedProfile, { merge: true });
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
    const snap = await getDocs(usersCol);
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
}

/**
 * Salva a base pessoal do usuário no Firestore
 */
export async function syncPersonalKnowledgeToCloud(
  userId: string,
  data: Partial<UserPersonalKnowledgeBase>
): Promise<void> {
  if (!userId) return;

  try {
    const userDocRef = doc(db, 'users', userId);

    // Salva metadados / stats
    if (data.stats) {
      const statsDocRef = doc(db, 'users', userId, 'knowledge_base', 'stats');
      await setDoc(statsDocRef, data.stats, { merge: true });
    }

    // Salva materiais
    if (data.materials) {
      const materialsDocRef = doc(db, 'users', userId, 'knowledge_base', 'materials');
      await setDoc(materialsDocRef, { items: data.materials, updatedAt: new Date().toISOString() });
    }

    // Salva nós do grafo
    if (data.nodes) {
      const nodesDocRef = doc(db, 'users', userId, 'knowledge_base', 'nodes');
      await setDoc(nodesDocRef, { items: data.nodes, updatedAt: new Date().toISOString() });
    }

    // Salva relações do grafo
    if (data.relations) {
      const relDocRef = doc(db, 'users', userId, 'knowledge_base', 'relations');
      await setDoc(relDocRef, { items: data.relations, updatedAt: new Date().toISOString() });
    }

    // Salva correções
    if (data.corrections) {
      const corrDocRef = doc(db, 'users', userId, 'knowledge_base', 'corrections');
      await setDoc(corrDocRef, { items: data.corrections, updatedAt: new Date().toISOString() });
    }
  } catch (err) {
    console.warn('Erro ao sincronizar base pessoal com o Firestore:', err);
  }
}

/**
 * Baixa a base pessoal do usuário do Firestore
 */
export async function fetchPersonalKnowledgeFromCloud(
  userId: string
): Promise<Partial<UserPersonalKnowledgeBase> | null> {
  if (!userId) return null;

  try {
    const result: Partial<UserPersonalKnowledgeBase> = {};

    const statsDoc = await getDoc(doc(db, 'users', userId, 'knowledge_base', 'stats'));
    if (statsDoc.exists()) {
      result.stats = statsDoc.data() as UserStats;
    }

    const materialsDoc = await getDoc(doc(db, 'users', userId, 'knowledge_base', 'materials'));
    if (materialsDoc.exists() && materialsDoc.data().items) {
      result.materials = materialsDoc.data().items;
    }

    const nodesDoc = await getDoc(doc(db, 'users', userId, 'knowledge_base', 'nodes'));
    if (nodesDoc.exists() && nodesDoc.data().items) {
      result.nodes = nodesDoc.data().items;
    }

    const relDoc = await getDoc(doc(db, 'users', userId, 'knowledge_base', 'relations'));
    if (relDoc.exists() && relDoc.data().items) {
      result.relations = relDoc.data().items;
    }

    const corrDoc = await getDoc(doc(db, 'users', userId, 'knowledge_base', 'corrections'));
    if (corrDoc.exists() && corrDoc.data().items) {
      result.corrections = corrDoc.data().items;
    }

    return result;
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
    const snap = await getDocs(col);
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

    // 1. Salva na coleção raiz /frequent_errors (para monitoramento de erros frequentes)
    const errRef = doc(db, 'frequent_errors', errorId);
    await setDoc(errRef, fullError, { merge: true });

    // 2. Salva também na subcoleção do usuário para redundância e isolamento
    if (errorData.userId) {
      const userErrRef = doc(db, 'users', errorData.userId, 'frequent_errors', errorId);
      await setDoc(userErrRef, fullError, { merge: true });
    }

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
    let q = query(errCol);
    if (userId) {
      q = query(errCol, where('userId', '==', userId));
    }
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
    const errRef = doc(db, 'frequent_errors', errorId);
    await deleteDoc(errRef);
    if (userId) {
      const userErrRef = doc(db, 'users', userId, 'frequent_errors', errorId);
      await deleteDoc(userErrRef);
    }
  } catch (err) {
    console.warn('Erro ao deletar erro frequente:', err);
  }
}


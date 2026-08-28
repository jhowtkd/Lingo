import { GraphNode, PedagogicalCorrection, NotebookLMSyncDoc } from '../types';
import { StorageService } from './storage';

export const NotebookLMService = {
  // Compila todo o conhecimento do estudante em um documento Markdown perfeitamente estruturado para ser fonte do NotebookLM
  compileStudyDoc(title = 'Caderno de Estudos e Grafo de Conhecimento'): NotebookLMSyncDoc {
    const nodes = StorageService.getNodes();
    const corrections = StorageService.getCorrections();
    const sessions = StorageService.getSessions();
    const now = new Date().toLocaleDateString('pt-BR');

    const topicos = nodes.filter((n) => n.tipo === 'topico');
    const conceitos = nodes.filter((n) => n.tipo === 'conceito');
    const dificuldades = nodes.filter((n) => n.tipo === 'dificuldade');
    const equivocos = nodes.filter((n) => n.tipo === 'equivoco');
    const objetivos = nodes.filter((n) => n.tipo === 'objetivo_aprendizagem');
    const anotacoes = nodes.filter((n) => n.tipo === 'anotacao');

    let md = `# ${title}\n`;
    md += `*Documento gerado automaticamente pelo Tutor Conversacional Pedagógico em ${now}*\n`;
    md += `*Fonte pronta para importação no Google NotebookLM (notebooklm.google.com)*\n\n`;

    md += `## 🎯 Objetivos de Aprendizagem\n\n`;
    if (objetivos.length > 0) {
      for (const obj of objetivos) {
        md += `- **${obj.titulo}**: ${obj.descricao} (Domínio estimado: ${obj.dominio_estimado}%)\n`;
      }
    } else {
      md += `*Nenhum objetivo definido no momento.*\n`;
    }
    md += `\n`;

    md += `## 📚 Tópicos e Conceitos Fundamentais\n\n`;
    for (const c of conceitos) {
      md += `### ${c.titulo}\n`;
      md += `${c.descricao}\n\n`;
      md += `- **Domínio:** ${c.dominio_estimado}%\n`;
      md += `- **Dificuldade:** ${c.dificuldade}/5\n`;
      if (c.evidencias && c.evidencias.length > 0) {
        md += `- **Evidências de Compreensão:** ${c.evidencias.join('; ')}\n`;
      }
      md += `\n`;
    }

    md += `## ⚠️ Dificuldades e Equívocos Recorrentes\n\n`;
    md += `*Esta seção é fundamental para o NotebookLM gerar resumos focados em sanar suas dúvidas frequentes.*\n\n`;
    for (const d of [...dificuldades, ...equivocos]) {
      md += `### [${d.tipo === 'equivoco' ? 'Equívoco' : 'Dificuldade'}] ${d.titulo}\n`;
      md += `${d.descricao}\n\n`;
      md += `- **Frequência de Ocorrência:** ${d.frequencia_erro} vez(es)\n`;
      md += `- **Última Revisão:** ${new Date(d.ultima_revisao).toLocaleDateString('pt-BR')}\n`;
      if (d.evidencias && d.evidencias.length > 0) {
        md += `- **Evidência Registrada:** ${d.evidencias.join('; ')}\n`;
      }
      md += `\n`;
    }

    md += `## 📝 Registro de Correções Pedagógicas\n\n`;
    for (const corr of corrections.slice(0, 10)) {
      md += `#### Conceito: ${corr.conceito} (${corr.gravidade.toUpperCase()})\n`;
      md += `- **Erro cometido:** ${corr.erro}\n`;
      md += `- **Explicação Pedagógica:** ${corr.explicacao}\n`;
      md += `- **Formulação Correta:** ${corr.resposta_corrigida}\n`;
      md += `- **Estado:** ${corr.estado_posterior}\n\n`;
    }

    md += `## 💡 Anotações e Mnemônicos\n\n`;
    for (const a of anotacoes) {
      md += `- **${a.titulo}**: ${a.descricao}\n`;
    }
    md += `\n`;

    md += `## 📊 Histórico de Sessões Recentes\n\n`;
    for (const s of sessions.slice(0, 5)) {
      md += `- **${new Date(s.inicio).toLocaleDateString('pt-BR')} - ${s.titulo}** (${s.duracao_minutos} min, ${s.respostas_corretas}/${s.respostas_totais} corretas, XP +${s.xp_obtido})\n`;
    }

    const doc: NotebookLMSyncDoc = {
      id: `doc-${Date.now()}`,
      titulo: title,
      ultima_sincronizacao: new Date().toISOString(),
      conteudo_markdown: md,
      total_topicos: topicos.length,
      total_conceitos: conceitos.length,
      total_anotacoes: anotacoes.length,
    };

    StorageService.saveOrUpdateNotebookDoc(doc);
    return doc;
  },

  // Exporta como arquivo Markdown .md
  downloadMarkdown(doc: NotebookLMSyncDoc) {
    const blob = new Blob([doc.conteudo_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.titulo.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Cria um Google Doc no Google Drive via API oficial se token disponível
  async exportToGoogleDocs(
    doc: NotebookLMSyncDoc,
    accessToken: string
  ): Promise<{ success: boolean; docId?: string; docUrl?: string; error?: string }> {
    try {
      // 1. Cria o documento vazio no Drive
      const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: doc.titulo,
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Falha ao criar Google Doc: ${createRes.status}`);
      }

      const createdDoc = await createRes.json();
      const docId = createdDoc.documentId;

      // 2. Insere o conteúdo no Google Doc
      const updateRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: doc.conteudo_markdown,
                },
              },
            ],
          }),
        }
      );

      if (!updateRes.ok) {
        throw new Error(`Falha ao preencher conteúdo do Doc: ${updateRes.status}`);
      }

      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

      // Atualiza no storage
      doc.google_doc_id = docId;
      doc.google_doc_url = docUrl;
      doc.ultima_sincronizacao = new Date().toISOString();
      StorageService.saveOrUpdateNotebookDoc(doc);

      // Desbloqueia conquista
      StorageService.unlockAchievement('sincronizacao_notebooklm');

      return { success: true, docId, docUrl };
    } catch (err: any) {
      console.error('Erro na integração Google Docs:', err);
      return { success: false, error: err.message };
    }
  },
};

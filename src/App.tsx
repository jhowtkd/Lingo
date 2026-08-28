/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ChatTutor } from './components/ChatTutor';
import { FlashcardsView } from './components/FlashcardsView';
import { VocabularyDuelView } from './components/VocabularyDuelView';
import { GraphMemoryView } from './components/GraphMemoryView';
import { CalendarPlanning } from './components/CalendarPlanning';
import { MaterialsView } from './components/MaterialsView';
import { WeeklyDashboard } from './components/WeeklyDashboard';
import { AchievementsView } from './components/AchievementsView';
import { LanguageThemeSelector } from './components/LanguageThemeSelector';
import { Pricing } from './components/ui/single-pricing-card-1';
import { GridBackground } from './components/ui/grid-background';
import { CornerPlus } from './components/ui/corner-plus';
import { BorderTrailWrapper } from './components/ui/border-trail-card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { UserStats, LanguageThemeId } from './types';
import { StorageService } from './services/storage';
import { getLanguageTheme, detectLanguageTheme } from './services/languageThemes';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [currentTopic, setCurrentTopic] = useState<string>('Inglês: Connected Speech & Pronúncia Natural');
  const [stats, setStats] = useState<UserStats>(StorageService.getStats());
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState('');

  // Identificação do Tema do Idioma Ativo
  const activeLanguageTheme = getLanguageTheme(stats.idioma_ativo || currentTopic);

  useEffect(() => {
    // Sincroniza dados iniciais
    setStats(StorageService.getStats());
  }, []);

  const handleUpdateStats = (newStats: UserStats) => {
    setStats(newStats);
  };

  const handleResetData = () => {
    if (
      window.confirm(
        'Tem certeza de que deseja restaurar todos os dados para o padrão inicial do MVP? Isto resetará o chat, grafo e materiais de teste.'
      )
    ) {
      StorageService.resetToDefaults();
      setStats(StorageService.getStats());
      window.location.reload();
    }
  };

  const handleSelectTopic = (topic: string) => {
    setCurrentTopic(topic);
    const themeId = detectLanguageTheme(topic);
    const langConfig = getLanguageTheme(topic);
    const updatedStats = { ...stats, idioma_ativo: langConfig.nome };
    StorageService.saveStats(updatedStats);
    setStats(updatedStats);
    setActiveTab('chat');
  };

  const handleLanguageChange = (langName: string, themeId: LanguageThemeId) => {
    let defaultTopicForLang = `${langName}: Conversação Cotidiana & Vocabulário Essencial`;
    if (langName === 'Inglês') defaultTopicForLang = 'Inglês: Connected Speech & Pronúncia Natural';
    if (langName === 'Espanhol') defaultTopicForLang = 'Espanhol: Conversação Cotidiana & Diferenças Culturais';
    if (langName === 'Francês') defaultTopicForLang = 'Francês: Pronúncia & Vocabulário para Viagens';
    if (langName === 'Alemão') defaultTopicForLang = 'Alemão: Estrutura de Frases & Artigos';
    if (langName === 'Italiano') defaultTopicForLang = 'Italiano: Pronúncia Melódica & Expressões Diárias';
    if (langName === 'Japonês') defaultTopicForLang = 'Japonês: Hiragana, Katakana & Saudações Contextuais';

    setCurrentTopic(defaultTopicForLang);
    const updatedStats = { ...stats, idioma_ativo: langName };
    StorageService.saveStats(updatedStats);
    setStats(updatedStats);
  };

  const handleSaveCustomTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTopicInput.trim()) {
      handleSelectTopic(customTopicInput.trim());
      setCustomTopicInput('');
      setShowTopicModal(false);
    }
  };

  const presetTopics = [
    'Inglês: Connected Speech & Pronúncia Natural',
    'Inglês: Falsos Amigos & Vícios de Tradução',
    'Inglês: Phrasal Verbs Essenciais no Trabalho',
    'Espanhol: Conversação Cotidiana & Diferenças Culturais',
    'Espanhol: Falsos Amigos & Verbos Reflexivos',
    'Francês: Pronúncia & Vocabulário para Viagens',
    'Alemão: Estrutura de Frases & Artigos',
    'Italiano: Expressões Idiomáticas & Pronúncia Melódica',
    'Japonês: Frases Essenciais & Estrutura Contextual',
  ];

  return (
    <div
      data-lang-theme={activeLanguageTheme.id}
      className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background transition-colors duration-500"
    >
      {/* Barra de Navegação Superior */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        currentTopic={currentTopic}
        onTopicClick={() => setShowTopicModal(true)}
        onResetData={handleResetData}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col bg-background/50">
        <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <div
            className={`rounded-2xl border border-border/80 bg-card shadow-xs min-h-[calc(100vh-7.5rem)] flex flex-col transition-all duration-300 ${activeLanguageTheme.card_accent}`}
          >
            {activeTab === 'chat' && (
              <ChatTutor
                currentTopic={currentTopic}
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onSelectTopic={handleSelectTopic}
              />
            )}

            {activeTab === 'flashcards' && (
              <FlashcardsView
                currentTopic={currentTopic}
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onNavigateToGraph={() => setActiveTab('graph')}
                onPracticeInChat={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'duel' && (
              <VocabularyDuelView
                currentTopic={currentTopic}
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onNavigateToGraph={() => setActiveTab('graph')}
                onPracticeInChat={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'materials' && (
              <MaterialsView
                onPracticeInChat={(topic, language) => {
                  setCurrentTopic(`${language}: ${topic}`);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'graph' && <GraphMemoryView />}

            {activeTab === 'calendar' && <CalendarPlanning />}

            {activeTab === 'dashboard' && (
              <WeeklyDashboard
                onStartReview={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'achievements' && (
              <AchievementsView
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onResetData={handleResetData}
              />
            )}

            {activeTab === 'pricing' && <Pricing />}
          </div>
        </main>
      </div>

      {/* Modal para Alteração de Tópico de Estudos & Paleta Temática */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-card border border-border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-foreground max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="space-y-1">
                <div className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  IMMERSIVE LANGUAGE SETUP
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Alterar Idioma & Foco Temático</span>
                  <span className={`text-xs px-2 py-0.5 rounded border font-mono ${activeLanguageTheme.badge_class}`}>
                    {activeLanguageTheme.bandeira} {activeLanguageTheme.nome}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1.5 rounded hover:bg-muted transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Seletor Visual de Idioma e Tema Dinâmico */}
            <LanguageThemeSelector
              currentLanguage={stats.idioma_ativo || currentTopic}
              onSelectLanguage={(langName, themeId) => {
                handleLanguageChange(langName, themeId);
              }}
            />

            {/* Trilhas Sugeridas de Tópicos */}
            <div className="space-y-3 pt-3 border-t border-border">
              <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider block">
                Trilhas Recomendadas:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {presetTopics.map((t, idx) => {
                  const isSelected = currentTopic === t;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        handleSelectTopic(t);
                        setShowTopicModal(false);
                      }}
                      className={`p-2.5 rounded-lg border text-left font-medium transition text-xs flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground font-semibold shadow-2xs'
                          : 'bg-muted/40 border-border text-foreground hover:bg-muted hover:border-border/80'
                      }`}
                    >
                      <span className="truncate">{t}</span>
                      {isSelected && (
                        <Badge variant="secondary" className="bg-background text-foreground text-[9px] shrink-0 ml-1">
                          ATIVO
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tópico Personalizado */}
              <form onSubmit={handleSaveCustomTopic} className="pt-3 border-t border-border space-y-2">
                <label className="text-muted-foreground font-mono text-xs block">
                  Ou defina um tema de foco livre:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTopicInput}
                    onChange={(e) => setCustomTopicInput(e.target.value)}
                    placeholder="Ex: Espanhol para Negócios, Francês A2, Entrevistas em Inglês..."
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <Button type="submit" size="sm" className={activeLanguageTheme.button_class}>
                    Definir Foco
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




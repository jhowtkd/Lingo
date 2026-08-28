import React, { useState } from 'react';
import { Camera, Download, Loader2, CheckCircle2, Copy, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from './ui/button';

interface ScreenCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const ScreenCaptureModal: React.FC<ScreenCaptureModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<
    Array<{ id: string; title: string; dataUrl: string }>
  >([]);
  const [currentCapturingScreen, setCurrentCapturingScreen] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const screens = [
    { id: 'chat', label: '1. Chat Tutor de Línguas' },
    { id: 'flashcards', label: '2. Flashcards SRS (3D Flip)' },
    { id: 'duel', label: '3. Duelo de Vocabulário' },
    { id: 'graph', label: '4. Memória em Grafo' },
    { id: 'misconceptions', label: '5. Dicionário de Erros' },
    { id: 'materials', label: '6. Estúdio de Materiais & Vídeos' },
    { id: 'calendar', label: '7. Planejamento & Calendário' },
    { id: 'achievements', label: '8. Conquistas & Gamificação' },
    { id: 'dashboard', label: '9. Planos & Assinatura' },
  ];

  if (!isOpen) return null;

  // Função para capturar tela atual
  const captureCurrentView = async (screenId: string, screenLabel: string) => {
    const mainEl = document.getElementById('main-app-content');
    if (!mainEl) return null;

    try {
      const dataUrl = await toPng(mainEl, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
      });
      return { id: screenId, title: screenLabel, dataUrl };
    } catch (err) {
      console.error('Erro ao capturar tela:', err);
      return null;
    }
  };

  // Capturar a tela atualmente aberta
  const handleCaptureActiveOnly = async () => {
    setIsCapturing(true);
    const activeScreenObj = screens.find((s) => s.id === activeTab) || screens[0];
    setCurrentCapturingScreen(activeScreenObj.label);

    await new Promise((r) => setTimeout(r, 400));
    const result = await captureCurrentView(activeScreenObj.id, activeScreenObj.label);
    if (result) {
      setCapturedImages((prev) => [result, ...prev.filter((p) => p.id !== result.id)]);
    }
    setIsCapturing(false);
    setCurrentCapturingScreen('');
  };

  // Capturar todas as telas do sistema automaticamente em lote
  const handleCaptureAllScreens = async () => {
    setIsCapturing(true);
    const results: Array<{ id: string; title: string; dataUrl: string }> = [];
    const originalTab = activeTab;

    for (const screen of screens) {
      setCurrentCapturingScreen(screen.label);
      setActiveTab(screen.id);
      // Espera renderização e animações estabilizarem
      await new Promise((resolve) => setTimeout(resolve, 800));

      const res = await captureCurrentView(screen.id, screen.label);
      if (res) {
        results.push(res);
      }
    }

    setCapturedImages(results);
    setActiveTab(originalTab);
    setIsCapturing(false);
    setCurrentCapturingScreen('');
  };

  // Baixar um print individual
  const handleDownload = (img: { id: string; title: string; dataUrl: string }) => {
    const link = document.createElement('a');
    link.download = `tela_${img.id}_${Date.now()}.png`;
    link.href = img.dataUrl;
    link.click();
  };

  // Baixar todos os prints capturados
  const handleDownloadAll = () => {
    capturedImages.forEach((img, idx) => {
      setTimeout(() => {
        handleDownload(img);
      }, idx * 300);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border/80 rounded-3xl max-w-4xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Gerador de Prints em Alta Resolução (PNG)
              </h2>
              <p className="text-xs text-muted-foreground">
                Tire screenshots em PNG com 1 clique de qualquer tela ou de todas automaticamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            ✕
          </button>
        </div>

        {/* Ações de Captura */}
        <div className="py-4 flex flex-wrap items-center gap-3 bg-secondary/30 p-4 rounded-2xl my-4 border border-border/60">
          <Button
            onClick={handleCaptureAllScreens}
            disabled={isCapturing}
            className="gap-2 rounded-xl font-semibold shadow-xs"
          >
            {isCapturing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Capturando: {currentCapturingScreen}...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Capturar Todas as 9 Telas em PNG</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleCaptureActiveOnly}
            disabled={isCapturing}
            className="gap-2 rounded-xl font-semibold border-border/80 hover:bg-secondary"
          >
            <Camera className="w-4 h-4 text-muted-foreground" />
            <span>Tirar Print Apenas da Tela Atual</span>
          </Button>

          {capturedImages.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleDownloadAll}
              disabled={isCapturing}
              className="gap-2 rounded-xl font-semibold ml-auto"
            >
              <Download className="w-4 h-4 text-foreground" />
              <span>Baixar Todos os {capturedImages.length} PNGs</span>
            </Button>
          )}
        </div>

        {/* Galeria de Prints Gerados */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {capturedImages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <Camera className="w-12 h-12 mx-auto stroke-1 text-muted-foreground/50" />
              <p className="text-sm font-medium">
                Nenhum print gerado ainda. Clique no botão acima para capturar todas as telas!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capturedImages.map((img) => (
                <div
                  key={img.id}
                  className="bg-card border border-border/80 rounded-2xl p-3 shadow-xs space-y-2 hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground truncate">{img.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                      PNG HD
                    </span>
                  </div>

                  <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted/40 aspect-video flex items-center justify-center">
                    <img
                      src={img.dataUrl}
                      alt={img.title}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(img)}
                      className="gap-1.5 text-xs rounded-xl font-semibold border-border/80 hover:bg-secondary w-full"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Imagem PNG</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Formato: PNG 2x Retina Quality sem perda de nitidez</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};

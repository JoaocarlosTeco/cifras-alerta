package br.alerta.cifras;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Abre o site das cifras dentro do app, em tela cheia.
 * As músicas vêm do site: o que for publicado lá aparece aqui sem atualizar o app.
 * Depois da primeira abertura o próprio site guarda tudo no aparelho e funciona sem internet.
 */
public class MainActivity extends Activity {

    private static final String SITE = "https://joaocarlosteco.github.io/cifras-alerta/";
    private static final String DOMINIO = "joaocarlosteco.github.io";

    private WebView pagina;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        Window janela = getWindow();
        // A tela não apaga enquanto a cifra está aberta.
        janela.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        janela.setStatusBarColor(Color.BLACK);
        janela.setNavigationBarColor(Color.BLACK);

        pagina = new WebView(this);
        pagina.setBackgroundColor(Color.BLACK);
        setContentView(pagina);

        WebSettings ajustes = pagina.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true); // guarda tom, tamanho da letra e tema
        ajustes.setDatabaseEnabled(true);
        ajustes.setMediaPlaybackRequiresUserGesture(true);
        ajustes.setTextZoom(100); // o tamanho da letra é controlado dentro do app

        pagina.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest pedido) {
                Uri destino = pedido.getUrl();
                if (DOMINIO.equals(destino.getHost())) return false; // continua dentro do app
                // Links de fora (por exemplo "Abrir a cifra") abrem no navegador.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, destino));
                } catch (Exception semNavegador) {
                    // sem aplicativo para abrir o link: não faz nada
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap icone) {
                super.onPageStarted(view, url, icone);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest pedido, WebResourceError erro) {
                // Só a página principal: sem internet na primeira abertura.
                if (pedido.isForMainFrame()) view.loadDataWithBaseURL(null, AVISO_SEM_INTERNET, "text/html", "utf-8", null);
            }
        });

        if (estado != null) pagina.restoreState(estado);
        else pagina.loadUrl(SITE);
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        pagina.saveState(estado);
    }

    @Override
    public void onBackPressed() {
        // Voltar: da cifra para a lista; na lista, sai do app.
        if (pagina.canGoBack()) pagina.goBack();
        else super.onBackPressed();
    }

    private static final String AVISO_SEM_INTERNET =
        "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>"
        + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        + "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:center;"
        + "padding:32px;background:#000;color:#fff;font-family:sans-serif}"
        + "h1{font-size:34px;line-height:1.05;margin:0 0 12px}p{color:#bbb;font-size:17px;line-height:1.4;margin:0 0 28px}"
        + "a{display:inline-block;align-self:flex-start;padding:16px 26px;border-radius:18px 5px 18px 5px;"
        + "background:#fff;color:#000;font-weight:700;font-size:17px;text-decoration:none}</style></head>"
        + "<body><h1>Sem internet</h1>"
        + "<p>Na primeira vez o app precisa de internet para buscar as cifras. Depois disso ele funciona sem conexão.</p>"
        + "<a href='" + SITE + "'>Tentar de novo</a></body></html>";
}

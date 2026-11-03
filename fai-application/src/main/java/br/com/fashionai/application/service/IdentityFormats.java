package br.com.fashionai.application.service;

/** Texto das mensagens de identidade: e-mail mascarado, nome curto do aparelho, HTML escapado e campo em branco. */
final class IdentityFormats {
    private IdentityFormats() {
    }

    static String maskEmail(String mail) {
        int at = mail.indexOf('@');
        if (at <= 1) {
            return "***" + mail.substring(Math.max(0, at));
        }
        return mail.charAt(0) + "***" + mail.substring(at);
    }

    static String shortAgent(String ua) {
        if (ua == null) {
            return "Dispositivo";
        }
        String browser = ua.contains("Edg") ? "Edge" : ua.contains("Chrome") ? "Chrome" : ua.contains("Firefox") ? "Firefox"
                : ua.contains("Safari") ? "Safari" : "Navegador";
        String os = ua.contains("Android") ? "Android" : ua.contains("iPhone") || ua.contains("iPad") ? "iOS"
                : ua.contains("Windows") ? "Windows" : ua.contains("Mac") ? "macOS" : ua.contains("Linux") ? "Linux" : "";
        return (browser + " " + os).trim();
    }

    static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}

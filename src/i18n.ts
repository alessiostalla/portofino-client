import i18next from "i18next";

export function initDefaultI18n(language: string) {
    return i18next.init({
        lng: language,
        resources: {
            en: {
                translation: {
                    "portofino": {
                        "authcz": {
                            "error": {
                                "failedToRefreshToken": "Failed to refresh token"
                            }
                        }
                    }
                }
            }
        }
    });
}

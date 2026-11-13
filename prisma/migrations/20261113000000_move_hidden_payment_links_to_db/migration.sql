-- Carry over the payment links previously hidden via data/hidden-payment-links.json
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES
    ('hidden_payment_link:plink_1RvOVL2ekhGx3kFirPIuReQ1', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RvOXD2ekhGx3kFi44kESqub', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RvP802ekhGx3kFiSia4lbQ8', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RvPA62ekhGx3kFi5oLfYHgt', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1Rw7hb2ekhGx3kFiFNDMSBBI', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1Rw7x32ekhGx3kFivlwHW6DM', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1Rw8BS2ekhGx3kFif3wKul5L', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1Rw8ae2ekhGx3kFiETHXPrnU', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1S74vsGkwDpf2nNuswiUGxQi', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1S72D9GkwDpf2nNugud0gdvR', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1S6EQXGkwDpf2nNu7sgDq3mb', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RzeeQGkwDpf2nNuDsCJsVNl', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RzKu9GkwDpf2nNuKUJmrab2', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RwrrTGkwDpf2nNuE3KKD2oT', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RvPpvGkwDpf2nNuwhZFGLXs', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RvPpVGkwDpf2nNuUtI7hFE9', '1', CURRENT_TIMESTAMP),
    ('hidden_payment_link:plink_1RvPnBGkwDpf2nNueUIWKHu0', '1', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

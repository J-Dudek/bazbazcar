-- Numéro de contact facultatif, renseigné par le conducteur à la proposition
-- du trajet, pour que les passagers puissent le joindre.
alter table trajets add column telephone_contact text;

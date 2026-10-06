// Détection des investisseurs individuels (business angels) : un nom de personne commence par un
// prénom connu, compte 2 à 4 mots et ne contient aucun mot d'organisation.
// Fonctionne en Node (CommonJS) et dans le navigateur (window.PeopleDetect).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PeopleDetect = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const FIRST = new Set(`xavier thomas nicolas jean pierre philippe olivier frederic francois julien antoine alexandre stephane laurent marc michel patrick christophe vincent guillaume sebastien romain maxime mathieu matthieu david charles paul louis arthur hugo clement florian benjamin jerome fabrice eric thibaud thibault quentin adrien simon raphael gabriel bruno denis didier emmanuel edouard alain andre bernard yann yves cedric damien arnaud bertrand benoit cyril fabien franck gregoire gilles henri jacques jeremy jonathan kevin lucas ludovic marie sophie julie claire anne camille celine charlotte chloe caroline delphine elise emma laure laura lea manon marine mathilde nathalie pauline sarah valerie virginie isabelle catherine helene agnes aurelie audrey alice amelie anais roxanne fanny juliette margaux clara ines karim mehdi mohamed rachid samir yassine ali ahmed omar mark michael john james peter richard robert william steve tony edward ben tom daniel alex chris andrew matt jeff jason brian ryan joe sam max felix jan lars niklas sven mathias gauthier herve rodolphe renaud sylvain thierry tristan victor wilfried yohan joel loic mickael pascal regis remi serge steven teddy timothee tanguy gael gaetan geoffroy gautier erwan etienne fabio francis frank gerard guy hadrien hugues igor ivan jordan joseph jules leo leon lionel lucien marcel martin maurice morgan nathan noel octave oscar pablo rafael rene roland ronan ruben sacha samuel stanislas sylvie theo tim ugo valentin yoann zoe brice baptiste bastien axel aurelien augustin alexis amaury anthony armand cecile corinne dominique elodie estelle eva florence frederique gaelle ingrid jeanne josephine lucie lydie magali marion melanie morgane muriel nadia nina oceane patricia rebecca sabrina sandrine severine solene stephanie sylviane tatiana veronique yasmine zineb fatima leila mariam hannah olivia jessica jennifer elizabeth kate katie emily amanda rachel nancy susan lisa anna maria elena giulia luca marco matteo alessandro giovanni andrea stefano carlos javier miguel diego juan pedro jorge luis fernando hans klaus jens jonas lukas tobias florent cyrille dimitri eliott elliot gregory harold jacky jimmy kenny marius maximilien nils noah oliver ralph reza roman sami sofiane taha tarek walid wassim yanis yannick youssef zakaria arash farid hicham hamza nabil reda riad sofian amine anas ayoub bilal ilyes imran ismail khalil mounir nassim othmane rayan redouane said ziad clotilde eleonore gwenaelle helena lou maud perrine quitterie solenne domitille capucine apolline diane constance blandine`.split(/\s+/));
  const ORG = /\b(capital|ventures?|invest\w*|fund|fonds|partners|group|groupe|holding|bank|banque|credit|caisse|angels?|club|region|sas?|gestion|equity|labs?|studio|foundation|fondation|corp|inc|ltd|gmbh|ag|bv|family|office|accelerat\w*|incubat\w*|bpi\w*|universit\w*|ecole|school|participations?|developpement|innovation|impact|vc|tech|management|assets?|finance|financiere|mutuel\w*|assurances?|insurance|global|international|network|collective|seed|growth|cvc|metropole|electricite|aviation|world|maison|etablissement|freres|active|croissance|littoral|machine|wise|guys|boss|graines|first|societe|generale|france|europe)\b/;
  function isPerson(name) {
    const raw = String(name || "").replace(/\(.*?\)/g, " ").trim();
    const n = strip(raw);
    if (!n || ORG.test(n)) return false;
    const words = n.split(/[\s]+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) return false;
    const first = words[0].split("-")[0];
    return FIRST.has(first) || FIRST.has(words[0]);
  }
  return { isPerson };
});

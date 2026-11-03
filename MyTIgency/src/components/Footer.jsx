import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLenis } from 'lenis/react'
import { useRoute, scrollToTop, curtainTo, originOf } from '../utils/pageTransition'
import { useLanguage } from '../context/LanguageContext'
import empresaImg from '../assets/empresa.jpg'
import conversaImg from '../assets/conversa.jpg'
import eSeuImg from '../assets/e-seu.jpg'
import ajustesImg from '../assets/ajustes.jpg'
import garantiaImg from '../assets/garantia.jpg'
import { copyText } from '../utils/copyText'
import './Footer.css'

const EMAILS = [
  { key: 'general', address: 'info@mytigency.com.br' },
  { key: 'projects', address: 'projetos@mytigency.com.br' },
]

// Coluna de informações (textos em strings.js → footer.info). Aqui só o que
// não traduz: foto, link e a posição aberta por padrão (Betim, no meio).
// Para trocar uma foto, substitua o arquivo em src/assets mantendo o nome.
const INFO_IMAGES = { talk: conversaImg, yours: eSeuImg, betim: empresaImg, changes: ajustesImg, warranty: garantiaImg }
const INFO_LINKS = { betim: 'https://www.google.com/maps/search/?api=1&query=Rua+Afro+Domingos+301+Filad%C3%A9lfia+Betim+MG' }
const INFO_DEFAULT = 2

// Menu e redes ainda são placeholders do protótipo (The Romans) — ver
// "Pendências" no PDF do footer.
const NAV_LINKS = { 'Contact Us': '/contato' }
const NAV = ['Work', 'About', 'Join us', 'Contact Us', 'Latest', 'Awards']

const ICONS = {
  arrow: { viewBox: '0 0 20 20', d: 'm16.838 9.996-6.54 6.54-1.767-1.768 3.522-3.523H3v-2.5h9.052L8.529 5.223l1.768-1.768 6.54 6.541Z' },
  copy: { viewBox: '0 0 20 20', d: 'M7 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1v-2h1V4H7v1H5V4a2 2 0 0 1 2-2ZM4 7h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v7h9V9H4Z' },
  check: { viewBox: '0 0 20 20', d: 'm8 15.4-5.2-5.2 1.8-1.8L8 11.8l7.4-7.4 1.8 1.8L8 15.4Z' },
  linkedin: { viewBox: '0 0 20 20', d: 'M17 1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h14Zm-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.320 1.3V8.13H8.13v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79ZM4.88 6.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.690 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68Zm1.39 9.94V8.13H3.5v8.37h2.77Z' },
  instagram: { viewBox: '0 0 20 20', d: 'M5.8 0h8.4C17.4 0 20 2.6 20 5.8v8.4a5.8 5.8 0 0 1-5.8 5.8H5.8C2.6 20 0 17.4 0 14.2V5.8A5.8 5.8 0 0 1 5.8 0Zm-.2 2A3.6 3.6 0 0 0 2 5.6v8.8C2 16.39 3.61 18 5.6 18h8.8a3.6 3.6 0 0 0 3.6-3.6V5.6C18 3.61 16.39 2 14.4 2H5.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM10 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' },
  youtube: { viewBox: '0 0 20 20', d: 'm8 13 5.19-3L8 7v6Zm11.56-7.830c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L20 10c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L10 17c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L0 10c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L10 3c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73Z' },
  romefm: { viewBox: '0 0 69 20', d: 'M61.848.376a217 217 0 0 1 7.075-.004c-.031.851-.014 1.785-.014 2.644v4.41l.002 12.237c-1.872-.048-3.767.012-5.640-.008a19 19 0 0 0-.813.006c.038-2.189.2-4.691.164-6.85.054-.293.017-1.343.005-1.676-.073.27-.095.4-.127.679-.028.17-.064.366-.078.537-.13 1.54-.367 3.066-.504 4.607-.08.9-.18 1.836-.353 2.722-.59-.066-2.145-.024-2.81-.022-.09-.654-.126-1.338-.2-1.996l-.47-3.871c-.11-.94-.148-1.701-.345-2.634q.034 4.262.172 8.522c-.517-.048-1.369-.026-1.91-.026q-1.57-.004-3.14.008c-.03-6.404.07-12.892-.009-19.285 2.615-.057 5.459-.008 8.089-.007 0 .37.035.801.06 1.175.108 1.63.16 3.288.283 4.916.006.14-.004.28.074.393l.045-.016c.086-.176.076-.398.084-.598.058-1.041.091-2.002.178-3.049.064-.771.212-2.082.182-2.814M53.44 19.073q1.927-.014 3.855-.006c-.034-.635-.033-1.296-.049-1.936a288 288 0 0 1-.082-4.147c-.01-.752.006-1.582-.038-2.325.328-.02.863-.042 1.19-.012.162 1.595.4 3.183.54 4.791.104 1.183.322 2.427.44 3.62l1.766.015c.034-.27.074-.545.102-.815.256-2.532.64-5.067.859-7.603.428-.022.808-.021 1.237-.017-.108.57-.07 2.387-.08 3.054q-.015 1.752-.064 3.502c-.014.585-.053 1.298-.039 1.87l5.25.001c-.05-3.478-.005-7.068-.004-10.554V3.75c0-.9-.018-1.866.012-2.76Q66.308.975 64.28.982c-.575 0-1.345.026-1.903.005-.036 1.657-.213 3.22-.315 4.87-.029.465-.08 1.23-.07 1.682-.38-.04-.848-.028-1.238-.028-.016-1.35-.128-2.59-.239-3.927-.061-.743-.156-1.853-.133-2.601L55.768.98c-.542 0-1.83.038-2.326-.012l.002 12.232v3.893c.001.582.033 1.423-.003 1.979M21.395.43c.57-.052 1.495-.027 2.079-.027l3.585.007.51 7.075c.072 1.01.062 2.116.195 3.114l.413-5.62c.118-1.562.245-2.957.32-4.541.456-.058 1.442-.035 1.93-.035l3.412.005c-.02.598-.003 1.317-.003 1.927v3.718l-.006 13.553c-.36-.048-1.462-.036-1.86-.03-.776.014-1.738-.03-2.494.023l.18-7.162c.037-1.45.108-3.063.083-4.504-.004-.286.003-.722-.035-.994-.09.539-.148 1.17-.207 1.72l-1.098 10.943c-.551-.05-1.771-.03-2.34-.009-.054-1.026-.21-2.017-.307-3.028l-.878-8.517a11 11 0 0 0-.082-1.065 6.4 6.4 0 0 0-.052 1.168q.112 3.637.15 7.277l.023 2.568c.005.494-.001 1.123.055 1.604a6 6 0 0 0-.592-.019c-.977.018-1.997-.045-2.97.018l.01-13.208V2.5c0-.54.03-1.587-.021-2.072M.087.42C1.009.39 1.943.396 2.865.402 5.59.42 9.145.02 9.773 3.557c.32 1.804.38 3.848-.175 5.609-.21.654-.86 1.26-1.484 1.514.627.23 1.275.571 1.548 1.217.449 1.063.338 2.462.338 3.608q.006 2.052-.012 4.104c-.395-.051-1.416-.037-1.84-.032-.781.009-1.743-.03-2.511.024.02-.255.006-.666.005-.932l.003-3.469c0-.625.031-1.283-.031-1.902-.092-.92-.425-.866-1.18-.867l-.003 7.173c-.909-.094-1.97.012-2.893-.027a14 14 0 0 0-1.47.026C.02 18.106.003.636.086.419m4.34 9.374c.219-.001.479.004.694-.007.076-.075.196-.185.254-.268.417-1.016.315-3.589.031-4.672-.096-.366-.647-.318-.96-.324-.067 1.732.037 3.556-.019 5.271M14.923.238c1.224-.046 2.537-.047 3.53.79 1.858 1.564 2.045 4.73 2.125 6.974.084 2.363.072 4.75-.28 7.082-.158 1.052-.61 2.433-1.26 3.273-.688.852-1.464 1.271-2.55 1.398-1.24.055-2.581.094-3.604-.735-1.51-1.223-1.826-3.43-2.023-5.25-.09-.833-.094-1.673-.119-2.51-.079-2.684-.115-7.554 1.627-9.711.63-.781 1.57-1.204 2.554-1.311m.945 15.454c.457-.834.382-2.936.396-3.921.013-.867.008-1.816.001-2.68-.012-1.47.073-2.99-.26-4.427-.074-.32-.193-.355-.492-.35a2.4 2.4 0 0 0-.294.862c-.175 1.306-.22 9.046.095 10.11.036.124.09.316.21.38.095.05.24.035.344.026M42.755.372C45.851.33 49.043.368 52.147.37c-.042.586-.01 1.586-.01 2.197l.004 3.9c-.942-.04-2.013-.008-2.973-.015.02.547.008 1.204-.003 1.748q1.164.013 2.328-.004c.03 1.41-.018 2.837.012 4.243-.699-.04-1.628-.014-2.339-.007.019.618.006 1.322.007 1.946l.003 5.3c-.787-.054-1.867-.025-2.68-.025-1.229-.001-2.525-.018-3.75.017-.043-1.337-.006-2.902-.006-4.258l.001-8.22v-4.65c0-.453-.032-1.785.014-2.169m.558 18.697c1.715-.004 3.565-.038 5.268 0l.001-5.345.002-1.915a97 97 0 0 0 2.324.006c-.008-.96-.035-2.083-.002-3.028-.702.048-1.657-.042-2.314.045q-.02-1.481-.012-2.962c.979 0 1.978-.01 2.955.004-.054-.676-.01-1.848-.012-2.559-.002-.619-.032-1.76.019-2.33L46.004.98c-.743 0-1.996.042-2.697-.002l.004 11.989v4.101c0 .627.026 1.39.002 2.001M34.667.413c2.317-.036 4.738-.018 7.060-.005-.024.48-.006 1.107-.006 1.595q-.005 1.275.009 2.55c-.765-.04-2.035.035-2.71-.042-.037 1.3-.013 2.745-.007 4.048q1.12.01 2.239-.001l-.001 2.848c-.675-.056-1.534.002-2.239-.021-.021 1.343-.009 2.765.002 4.11.694-.02 1.475-.004 2.175-.005h.734c-.03.393-.01 1.022-.01 1.431q.005 1.343-.006 2.685c-.366-.04-.96-.027-1.337-.027l-2.189-.002h-2.278c-.424 0-1.032-.014-1.44.028z' },
}

const SOCIALS = [
  { label: 'LinkedIn', icon: 'linkedin' },
  { label: 'Instagram', icon: 'instagram' },
  { label: 'YouTube', icon: 'youtube' },
  { label: 'Rome FM', icon: 'romefm', pill: true },
]

function Icon({ name, className }) {
  const { viewBox, d } = ICONS[name]
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true">
      <path fill="currentColor" d={d} />
    </svg>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 1725 912" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M1639.01 239C1638.23 238.02 1644.51 222.6 1645.53 220.03C1649.36 210.42 1661.68 187.6 1662.94 179.43C1664.44 169.71 1656.49 164.27 1648.67 160.82C1605.69 141.81 1519.69 166.42 1476.22 181.73C1472.04 183.2 1446.58 194.23 1444.99 192.99C1467.05 146.06 1412.44 117.13 1376.96 102.53C1310.21 75.07 1216.37 60.12 1144.5 66.01C1103.22 69.39 1100.25 101.79 1078.48 128.99C1073.61 110.54 1067.72 90.49 1049.67 80.81C1027.4 68.86 985.46 78.56 960.48 80.99C957.41 81.29 954.29 81.42 951.19 81.71C950.09 81.81 947.78 82.89 947.99 81.01C973.51 73.64 999.77 68.4 1025.2 60.71C1031.7 58.74 1039.39 57.13 1045.29 53.8C1060.78 45.06 1072.47 24.98 1076.54 8.05001C1077.01 6.11001 1076.13 0.350013 1078.47 1.01001C1090.75 9.99001 1093.91 27.02 1104.59 37.89C1130.74 64.48 1201.86 55.21 1236.44 54.95C1300.28 54.49 1378.12 68.97 1436.34 95.13C1472.53 111.39 1482.13 122.05 1525.35 115.85C1580.8 107.9 1624.46 87.45 1682.81 101.66C1775.38 124.2 1682.36 217.86 1639 238.98L1639.01 239Z" />
      <path fill="currentColor" d="M1301 233.99C1321.52 233.48 1342.02 230.44 1362.51 229.01C1433.35 224.06 1538.42 215.58 1606 234.5C1694.82 259.37 1666.87 319.46 1609.32 360.81C1553.47 400.94 1482.35 427.61 1420.65 458.14C1345.13 495.5 1278.99 543.86 1205.03 583.52C1082.59 649.18 952.44 695.83 818.66 733.15C768.71 778.89 736.38 860.01 681.33 898.82C668.63 907.78 658.42 914.64 662.46 891.95C665.66 873.96 673.68 858 675.89 838.38C684.01 766.38 645.3 770.73 588.5 772.99C446.59 778.65 325.06 806.11 185.24 758.27C160.55 749.82 118.6 729.48 93.5198 732.01C66.0598 734.78 28.8198 781.79 10.0398 801.53C8.80977 802.82 2.25977 810.01 1.00977 808.99C5.02977 771.97 30.0498 742.89 46.5298 711.02C49.7298 704.83 54.4698 695.84 55.5598 689.05C58.5198 670.58 39.8698 651.29 36.2998 631.21C19.0598 533.99 123.06 432.08 192.11 377.61C311.42 283.48 467.83 200 614.01 157.51C630.27 152.78 658.44 144 674.54 143.01C679.39 142.71 682.68 143.3 681.91 148.92C569.98 181.24 462.44 225.86 363.09 286.59C266.04 345.91 122.76 451.5 95.1298 567.63C89.4498 591.5 88.4098 620.33 98.2398 643.27C101.38 650.59 104.22 658.67 112.53 652.03C120.84 645.39 132.71 630.58 140.52 622.02C179.36 579.48 220.01 535.43 256.52 491.02C266.65 478.7 299.85 437.99 301.94 424.45C305.17 403.51 274.87 422.05 267.09 426.59C260.49 430.44 254.01 434.89 247.69 439.19C201.16 470.85 160.26 510.54 118.5 548C117.6 535.58 130.33 521.96 138.03 512.53C172.73 470.08 230.42 418.25 275.67 387.17C300.89 369.85 350.14 339.98 381.22 350.28C398.09 355.87 394.61 370.23 393.28 383.8C393.18 384.81 392.24 386.26 393.99 385.99C394.05 384.86 394.72 383.78 395.46 382.96C428.39 346.58 470.75 293.08 519.79 280.28C547.34 273.09 578.32 275.59 568.33 312.82L557.5 341.99C596.36 301.61 649.73 253.52 708.52 249.01C784.73 243.16 763.74 311.73 739.8 354.29C713.41 401.21 648.21 455.8 654.13 512.37C658.72 556.31 729.27 570.34 764.63 574.87C785.5 577.55 831.75 579.86 851.21 574.7C860.6 572.21 870.13 556.87 876.4 548.89C909.17 507.23 940 463.99 973.03 422.52C1001.93 386.24 1032.56 351.33 1062 315.49C1060.93 313.81 1059.81 315.9 1059.02 316.51C980.2 377 909.72 444.69 818.37 487.86C789.37 501.56 707.51 536.1 704.03 479.49C700.77 426.5 780.27 351.41 813.52 313.02C833.18 290.31 874.06 240.31 875.91 210.36C877.59 183.24 842.68 187.25 826.04 194.54L761.01 218.51C796.98 180.67 846.74 147.55 897.8 134.3C925.09 127.22 996.09 116.28 1000.9 157.62C1005.24 194.85 954.56 262.96 932.4 292.9C917.38 313.2 873.78 362.49 870.25 384.75C864.86 418.75 906.97 399.59 922.03 391.53C977.69 361.74 1029.27 314.83 1081.69 279.19C1093.06 271.46 1099.55 266.6 1113.18 262.68C1149.92 252.11 1190.31 248 1227.98 241.48C1243.55 218.44 1258.91 194.55 1268.95 168.45L1361.51 113.01L1301 233.99ZM1425.79 264.29C1377.12 265.44 1327.48 269.82 1279.41 276.91C1261.28 312 1242.17 348.3 1227.52 385.02C1223.25 395.73 1214.28 416.46 1216.05 427.43C1217.31 435.24 1227.92 438.03 1234.61 438.86C1287.8 445.5 1382.95 414.24 1434.51 396C1473.43 382.23 1563.54 348.38 1586.4 314.89C1605.4 287.07 1571.48 276.81 1550.17 272.29C1510.8 263.94 1465.99 263.32 1425.78 264.27L1425.79 264.29ZM1202 287.01C1183.74 288.41 1170.64 295.87 1158.49 308.99C1130.08 339.64 1103.82 381.12 1076.98 414.48C1043.17 456.51 1005.96 495.68 972.03 537.53C968.04 542.45 949.8 564.63 949.43 568.94C949.17 571.99 955.32 572.77 957.52 572.99C1006.9 577.94 1066.62 559.48 1116.46 556.96C1121.98 556.68 1133.14 555.39 1133 562.99L934.73 594.23L837 714.99C949.93 681.64 1060.81 638.65 1164.67 583.17C1205.55 561.33 1252.59 533.86 1289.32 505.82C1293.71 502.47 1313.33 488.82 1308.1 482.41C1304.46 477.95 1280.75 484.79 1274.79 486.29C1231.72 497.09 1132.2 534.41 1092.56 521.95C1062.36 512.46 1081.03 475.79 1090.84 457.33C1103.23 434.01 1119.57 409.78 1133.99 387.48C1155.95 353.52 1179.34 320.48 1202.01 287.01H1202ZM519.99 568.99C532.02 534.37 552.6 501.72 572.58 471.08C592.56 440.44 619.61 407.43 637.16 374.66C645.42 359.25 663.02 322.32 630.6 326.1C599.05 329.77 548.15 388.25 530.18 413.68C508.39 444.52 467.94 513.66 473.08 551.41C473.48 554.35 475.05 557.4 476.56 559.93L485.99 568.98C437.6 572.12 388.72 581.5 345.49 603.98C344.68 602.26 346.35 599.26 346.98 597.47C369.82 532.98 422.85 471.66 453.87 410.36C457.65 402.9 475.6 368.5 455.18 373.66C439.12 377.72 403.47 420.34 392.02 434.51C358.46 476.04 327.45 522.73 297.58 567.07C284.96 585.8 273.68 610.48 254.29 622.78C211.69 649.83 160.5 669.61 122.97 704.46C120.54 706.71 110.06 715.59 117.49 716.97C123.88 718.16 134.32 716.49 141.48 716.98C170.94 719.01 196.26 735.4 223.47 744.99C321.05 779.37 442.42 778.18 544.48 767.96C568.59 765.55 604.26 762.33 626.53 754.01C649.34 745.49 635.4 736.03 621.9 727.55C568.47 694 448.28 674.95 386.65 684.13C375.96 685.72 346.88 689.89 353.74 706.71C357.98 717.09 385.45 725.03 395.77 727.68C439.19 738.83 481.28 739.32 525.48 742.97C530.8 743.41 547.08 744.21 550.52 746.93C551.45 747.66 552.06 748.8 552.54 749.87C552.92 751.69 551.35 753.85 549.5 753.97C473.27 752.24 396.4 758.3 320.51 750.96C297.87 748.77 236.28 740.99 224.15 720.32C217.43 708.86 226.53 700.66 235.7 695.17C272.73 672.99 365.82 663.54 410.51 658.98C499.87 649.86 603.61 643.82 692.36 657.12C719.54 661.19 749.99 667.35 769.53 687.95L770.98 687.97L836.99 596.98C796.83 595.39 756.53 594.69 716.5 590.97C662.88 585.98 608.88 575.68 555.49 570.98C543.66 569.94 531.76 570.45 519.99 568.97V568.99Z" />
    </svg>
  )
}

const preventDefault = (e) => e.preventDefault()

export function Footer() {
  const { t } = useLanguage()
  const f = t.footer
  const lenis = useLenis()
  const route = useRoute()
  // Já na página de contato, "Let's talk" / Contact Us não troca de página:
  // sobe suave até o topo do contato.
  const toContact = (e) => {
    if (route !== '/contato') return
    e.preventDefault()
    lenis?.scrollTo(0, { duration: 1.6 })
  }
  // Logo do rodapé: a Hero é fixa, então a âncora #top não rola (ver Header.jsx).
  // Na home, sair do rodapé para o topo é troca de seção: a cortina de dither
  const toTop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (route === '/contato') scrollToTop()
    else curtainTo('top', originOf(e))
  }

  const footerRef = useRef(null)
  const containerRef = useRef(null)
  const titleRef = useRef(null)
  const titleSvgRef = useRef(null)
  const dotRef = useRef(null)
  const pillRef = useRef(null)
  const copyTimer = useRef(0)

  const [activeInfo, setActiveInfo] = useState(INFO_DEFAULT)
  const [copied, setCopied] = useState(null)
  const [clock, setClock] = useState(null)

  /* Relógio de Minas Gerais: atualiza só na virada de cada minuto */
  useEffect(() => {
    const format = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    let timer
    function tick() {
      const now = new Date()
      const parts = Object.fromEntries(format.formatToParts(now).map((p) => [p.type, p.value]))
      setClock([parts.hour, parts.minute])
      timer = setTimeout(tick, 60000 - (now.getTime() % 60000) + 50)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  /* Copiar e-mail: o retorno aparece na hora; a cópia termina em segundo plano */
  function handleCopy(address) {
    setCopied(address)
    copyText(address)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(null), 1600)
  }

  /* Título gigante: recorta o viewBox no contorno exato das letras para ocupar toda a largura */
  useEffect(() => {
    const svg = titleSvgRef.current
    const text = svg.querySelector('text')
    let alive = true
    function fitTitle() {
      if (!alive) return
      const style = getComputedStyle(text)
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const m = ctx.measureText(text.textContent.toUpperCase())
      const width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      svg.setAttribute('viewBox', `${-m.actualBoundingBoxLeft} ${-m.actualBoundingBoxAscent} ${width} ${height}`)
    }
    fitTitle()
    document.fonts.load('100px Anton', text.textContent).then(fitTitle)
    return () => { alive = false }
  }, [])

  /* Cursor "Let's talk": ponto + pílula de vidro que segue o mouse com mola */
  useEffect(() => {
    const area = titleRef.current
    const dot = dotRef.current
    const pill = pillRef.current
    if (!area || !dot || !pill || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const OFFSET_X = 28 // distância para a direita do cursor
    const OFFSET_Y = 28 // distância para baixo do cursor
    const STIFFNESS = 0.09 // força da mola (maior = alcança mais rápido)
    const DAMPING = 0.78 // atrito (menor = balança mais)
    const TILT = 0.9 // inclinação por velocidade (graus por px/frame)
    const MAX_TILT = 14

    const mouse = { x: 0, y: 0 }
    const pos = { x: 0, y: 0 }
    const vel = { x: 0, y: 0 }
    let rotation = 0
    let active = false
    let rafId = 0

    function render() {
      const tx = mouse.x + OFFSET_X
      const ty = mouse.y + OFFSET_Y

      if (reduceMotion) {
        pos.x = tx
        pos.y = ty
        vel.x = vel.y = 0
      } else {
        vel.x = (vel.x + (tx - pos.x) * STIFFNESS) * DAMPING
        vel.y = (vel.y + (ty - pos.y) * STIFFNESS) * DAMPING
        pos.x += vel.x
        pos.y += vel.y
      }

      // Inclina na direção do movimento e volta suavemente quando para
      const targetRotation = Math.max(-MAX_TILT, Math.min(MAX_TILT, vel.x * TILT))
      rotation += (targetRotation - rotation) * 0.2
      const stretch = 1 + Math.min(Math.hypot(vel.x, vel.y) / 400, 0.08)

      dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`
      pill.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${rotation}deg) scale(${stretch}, ${2 - stretch})`

      const settled = Math.abs(vel.x) < 0.01 && Math.abs(vel.y) < 0.01 && Math.abs(rotation) < 0.01
      rafId = active || !settled ? requestAnimationFrame(render) : 0
    }

    function start() {
      if (!rafId) rafId = requestAnimationFrame(render)
    }

    function onEnter(e) {
      mouse.x = e.clientX
      mouse.y = e.clientY
      // Ao entrar, o container nasce já perto do cursor em vez de voar do canto da tela
      if (!active) {
        pos.x = mouse.x + OFFSET_X
        pos.y = mouse.y + OFFSET_Y
        vel.x = vel.y = 0
        rotation = 0
        pill.style.transform = `translate(${pos.x}px, ${pos.y}px)`
        dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`
      }
      active = true
      dot.classList.add('is-visible')
      pill.classList.add('is-visible')
      start()
    }

    function onMove(e) {
      mouse.x = e.clientX
      mouse.y = e.clientY
      start()
    }

    function onLeave() {
      active = false
      dot.classList.remove('is-visible')
      pill.classList.remove('is-visible')
    }

    // Ao rolar a página o mouse pode sair da área sem disparar pointerleave
    function onScroll() {
      if (active && !area.matches(':hover')) onLeave()
    }

    area.addEventListener('pointerenter', onEnter)
    area.addEventListener('pointermove', onMove)
    area.addEventListener('pointerleave', onLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      area.removeEventListener('pointerenter', onEnter)
      area.removeEventListener('pointermove', onMove)
      area.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  /* Footer empurra header e marquee: quando o topo do conteúdo do footer
     encosta na base do header, os dois sobem junto com ele (ver App.css) */
  useEffect(() => {
    const header = document.querySelector('header')
    const container = containerRef.current
    if (!header) return undefined
    const root = document.documentElement
    // O empurrão vai direto em quem o usa (header e marquee): uma variável no
    // <html> é herdada pela página inteira e recalculava o estilo de todos os
    // elementos a cada quadro — a travada ao chegar no footer
    const pushed = [header, document.querySelector('.marquee')].filter(Boolean)
    const setPush = (v) => pushed.forEach((el) => el.style.setProperty('--chrome-push', v))
    let push = 0
    let rafId = 0
    // Só mede com o footer a até uma tela de distância: medir a cada scroll da
    // página inteira forçava um layout por quadro (o Manifesto é enorme)
    let near = false
    const nearObserver = new IntersectionObserver(([e]) => {
      near = e.isIntersecting
      footerRef.current?.toggleAttribute('data-far', !near) // longe: o relógio para de piscar (Footer.css)
      onScroll()
    }, { rootMargin: '100% 0px' })
    nearObserver.observe(container)

    function update() {
      rafId = 0
      if (!near) {
        if (push) { push = 0; setPush('0px'); root.classList.remove('footer-revealed') }
        return
      }
      // Base do header sem o empurrão = até onde o "cromo" do topo desce
      const chromeBottom = header.getBoundingClientRect().bottom - push
      const next = Math.min(0, Math.max(-chromeBottom, container.getBoundingClientRect().top - chromeBottom))
      if (next === push) return
      push = next
      setPush(`${push}px`)
      root.classList.toggle('footer-revealed', push <= -chromeBottom)
    }

    function onScroll() {
      if (!rafId) rafId = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      nearObserver.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafId)
      pushed.forEach((el) => el.style.removeProperty('--chrome-push'))
      root.classList.remove('footer-revealed')
    }
  }, [])

  /* Fallback da animação de entrada para navegadores sem scroll-driven animations (Firefox, Safari antigo) */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || CSS.supports('animation-timeline: view()')) return undefined
    const footer = footerRef.current
    const container = containerRef.current
    let rafId = 0

    function update() {
      rafId = 0
      const vh = window.innerHeight
      // Posição do footer sem o transform aplicado
      const layoutTop = footer.offsetTop - window.scrollY
      const range = Math.min(footer.offsetHeight, vh)
      const p = Math.min(Math.max((vh - layoutTop) / range, 0), 1)
      footer.style.transform = `translateY(${-vh * (1 - p)}px)`
      container.style.transform = `translateY(${vh * 0.5 * (1 - p)}px)`
    }

    function onScroll() {
      if (!rafId) rafId = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafId)
      footer.style.transform = ''
      container.style.transform = ''
    }
  }, [])

  return (
    <>
      <footer className="site-footer" id="carreiras" ref={footerRef}>
        <div className="site-footer__container" ref={containerRef}>
          {/* Título gigante → página de contato */}
          <a
            className="site-footer__title"
            href="/contato"
            onClick={toContact}
            ref={titleRef}
            data-cursor="hidden"
            data-cursor-pill
            aria-label={`MyTIgency — ${f.talk}`}
          >
            <svg className="site-footer__say-hello" ref={titleSvgRef} viewBox="0 -73 368 73" fill="none" aria-hidden="true">
              <text className="site-footer__say-hello-text" x="0" y="0">MYTIGENCY</text>
            </svg>
          </a>

          {/* Contato: o retângulo copia o e-mail; o quadrado preto abre o app de e-mail */}
          <section className="ft-contact" aria-labelledby="ft-contact-title">
            <h2 className="ft-contact__title t-heading" id="ft-contact-title">{f.contactTitle}</h2>

            <ul className="ft-contact__list">
              {EMAILS.map(({ key, address }) => {
                const isCopied = copied === address
                const content = (
                  <>
                    <span className="ft-contact__copy-label">{isCopied ? f.copied : address}</span>
                    <Icon name={isCopied ? 'check' : 'copy'} className="ft-contact__copy-icon" />
                  </>
                )
                return (
                  <li key={key}>
                    <span className="ft-contact__desc t-small">{f.labels[key]}</span>
                    <div className="ft-contact__row">
                      <button type="button" className="ft-contact__copy" onClick={() => handleCopy(address)} aria-label={`${f.copyAria} ${address}`}>
                        <span className="ft-contact__copy-frame" />
                        <span className="ft-contact__copy-content">{content}</span>
                        <span className="ft-contact__copy-content ft-contact__copy-mask" aria-hidden="true">{content}</span>
                      </button>
                      <a className="ft-btn ft-btn--solid ft-btn--square ft-btn--large" href={`mailto:${address}`} aria-label={`${f.writeAria} ${address}`}>
                        <span className="ft-btn__bg" />
                        <span className="ft-btn__content"><Icon name="arrow" className="ft-btn__icon ft-btn__icon--diagonal" /></span>
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Horário de Minas Gerais (Brasília) atualizado em tempo real */}
            <p className="ft-contact__meta t-small">
              Minas Gerais,{' '}
              <time className="ft-contact__clock" dateTime={clock?.join(':')}>
                {clock ? <>{clock[0]}<span className="ft-contact__clock-sep">:</span>{clock[1]}</> : '--:--'}
              </time>{' '}
              — {f.reply}
            </p>
            <p className="sr-only" aria-live="polite">{copied ? `${copied} ${f.copiedAnnounce}` : ''}</p>
          </section>

          {/* Redes sociais (links a definir) */}
          <ol className="ft-social">
            {SOCIALS.map(({ label, icon, pill }) => (
              <li key={label}>
                <a href="#" onClick={preventDefault} className={`ft-btn ft-btn--outline ${pill ? 'ft-btn--pill' : 'ft-btn--square'}`} aria-label={label}>
                  <span className="ft-btn__bg" />
                  <span className="ft-btn__content"><Icon name={icon} className="ft-btn__icon" /></span>
                  <span className="ft-btn__mask" aria-hidden="true"><Icon name={icon} className="ft-btn__icon" /></span>
                </a>
              </li>
            ))}
          </ol>

          {/* Informações: passar o mouse/focar num item mostra os detalhes dele (só desktop) */}
          <section className="ft-offices" aria-label={f.infoLabel}>
            <ol className="ft-offices__links">
              {f.info.map((item, i) => (
                <li key={item.key}>
                  <a
                    className="ft-offices__link"
                    href="#"
                    data-active={i === activeInfo}
                    onMouseEnter={() => setActiveInfo(i)}
                    onFocus={() => setActiveInfo(i)}
                    onClick={preventDefault}
                  >
                    <span className="ft-offices__link-label">{item.name}</span>
                  </a>
                </li>
              ))}
            </ol>

            <ol className="ft-offices__details">
              {f.info.map((item, i) => {
                const lines = item.lines.map((line, j) => <span key={line}>{j > 0 && <br />}{line}</span>)
                const href = INFO_LINKS[item.key]
                return (
                  <li className="ft-office" key={item.key} data-active={i === activeInfo}>
                    <dl className="ft-office__info">
                      <dt className="t-heading">{f.details}</dt>
                      <dd className="ft-office__content t-small">
                        {href
                          ? <a href={href} target="_blank" rel="noreferrer" className="ft-office__address">{lines}</a>
                          : <p className="ft-office__address">{lines}</p>}
                        {item.note && <p>{item.note}</p>}
                      </dd>
                    </dl>
                    <div className="ft-office__image">
                      <img src={INFO_IMAGES[item.key]} alt="" loading="lazy" />
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* Navegação (itens ainda do protótipo) */}
          <ol className="ft-nav">
            {NAV.map((label) => (
              <li key={label}>
                <a className="ft-nav__link" href={NAV_LINKS[label] ?? '#'} onClick={NAV_LINKS[label] ? toContact : preventDefault}><span className="ft-nav__label t-heading">{label}</span></a>
              </li>
            ))}
          </ol>

          {/* Logo + legal */}
          <div className="ft-bottom">
            <a className="ft-bottom__logo" href="#top" aria-label="MyTIgency" onClick={toTop}>
              <Logo />
            </a>
            <div className="ft-bottom__legal t-small">
              <span>© 2026 MyTIgency&nbsp;·&nbsp;<a href="creditos.html">{f.credits}</a></span>
              <span>{f.tagline}</span>
            </div>
          </div>
        </div>
      </footer>

      {createPortal(
        <>
          <div className="talk-cursor-dot" ref={dotRef} aria-hidden="true" />
          <div className="talk-cursor-pill" ref={pillRef} aria-hidden="true">
            <div className="talk-cursor-pill__glass">
              <span className="talk-cursor-pill__label">{f.talk}</span>
              <span className="talk-cursor-pill__icon"><Icon name="arrow" /></span>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

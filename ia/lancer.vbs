' XozHub.AI - lance l'IA sans fenetre de console.
'
' Double-clic sur le raccourci du Bureau -> ce fichier -> Node demarre l'IA, qui
' ouvre SA fenetre (le navigateur en mode application). Aucune fenetre noire ne
' reste a l'ecran : c'est voulu, l'IA n'est pas un programme en ligne de commande.
'
' Si Node.js manque, on le dit clairement au lieu de ne rien faire du tout.

Option Explicit

Dim fso, shell, dossier, code
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

dossier = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = dossier

code = shell.Run("cmd.exe /c node """ & dossier & "\serveur.mjs""", 0, True)

If code <> 0 Then
  MsgBox "XozHub.AI n'a pas pu demarrer." & vbCrLf & vbCrLf & _
         "Le plus souvent, c'est Node.js qui manque sur cet ordinateur." & vbCrLf & _
         "Installe la version LTS depuis nodejs.org, puis relance XozHub.AI." & vbCrLf & vbCrLf & _
         "Autre possibilite : double-clique sur xozhub-ai.cmd, dans le dossier" & vbCrLf & _
         "d'installation - la fenetre restera ouverte et dira ce qui bloque.", _
         48, "XozHub.AI"
End If

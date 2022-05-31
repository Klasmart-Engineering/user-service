{{/*
Expand the name of the chart.
*/}}
{{- define "user_service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "user_service.fullname" -}}
{{- if .Values.fullNameOverride }}
{{- .Values.fullNameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "user_service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "user_service.labels" -}}
helm.sh/chart: {{ include "user_service.chart" . }}
{{ include "user_service.selectorLabels" . }}
app: {{ .Chart.Name | quote }}
app.kubernetes.io/version: {{ .Values.userService.tag | default .Chart.AppVersion | quote }}
version: {{ .Values.userService.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
release: {{ .Release.Name }}
chart: {{ .Chart.Name }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "user_service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "user_service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Set values for user count container
*/}}
{{- define "user_count.name" -}}
{{- default .Values.userCount.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name for user count
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "user_count.fullname" -}}
{{- if .Values.userCount.fullNameOverride }}
{{- .Values.userCount.fullNameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.userCount.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version for user count
*/}}
{{- define "user_count.chart" -}}
{{- printf "%s-%s" .Values.userCount.nameOverride .Values.userCount.tag | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "user_count.labels" -}}
{{ include "user_count.selectorLabels" . }}
app: {{ .Values.userCount.nameOverride | quote }}
app.kubernetes.io/version: {{ .Values.userCount.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
chart: {{ .Values.userCount.nameOverride }}
helm.sh/chart: {{ include "user_count.chart" . }}
release: {{ .Release.Name }}
version: {{ .Values.userCount.tag | default .Chart.AppVersion | quote }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "user_count.selectorLabels" -}}
app.kubernetes.io/name: {{ include "user_count.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

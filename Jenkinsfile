pipeline {
  agent any

  environment {
    // Bind Sonar token as secret text (create credential in Jenkins with id 'sonar-token')
    SONAR_TOKEN = credentials('sonar-token')
    // DockerHub credentials id (username/password type)
    DOCKERHUB_CREDS_ID = 'dockerhub-creds'
    // Docker repo to push to (change if needed)
    DOCKERHUB_REPO = 'dhina2406/ci-node-sample'
  }

  options {
    buildDiscarder(logRotator(daysToKeepStr: '7', numToKeepStr: '10'))
    timestamps()
    // optional: you can add timeout to long stages if you want
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        // Windows: use bat
        bat 'npm install'
        // run your test script - adjust if you use "npm test"
        bat 'npm test'
      }
    }

    stage('SonarScanner (Windows)') {
      steps {
        script {
          // SonarScanner must be configured in Manage Jenkins -> Global Tool Configuration as "SonarScanner"
          def scannerHome = tool 'SonarScanner'
          // withSonarQubeEnv requires a SonarQube server configured in Jenkins (name: SonarCloud)
          withSonarQubeEnv('SonarCloud') {
            // Run the Windows scanner .bat, write metadata report-task.txt into workspace
            bat """
              "${scannerHome}\\bin\\sonar-scanner.bat" ^
              -Dsonar.projectKey=dhina2406_ci-node-sample ^
              -Dsonar.organization=dhina2406 ^
              -Dsonar.sources=. ^
              -Dsonar.login=%SONAR_TOKEN% ^
              -Dsonar.scanner.metadataFile=%WORKSPACE%\\report-task.txt
            """
          }

          // Show report-task.txt (helpful for debugging)
          bat 'echo ---- report-task.txt ---- & if exist report-task.txt type report-task.txt || echo not-found & echo ------------------------'
        }
      }
    }

    stage('Quality Gate (poll Sonar)') {
      steps {
        script {
          // Read report-task.txt and extract ceTaskUrl
          def report = ''
          try {
            report = readFile('report-task.txt')
          } catch (err) {
            error "report-task.txt not found in workspace: ${err}"
          }

          def ceTaskUrl = null
          report.readLines().each { line ->
            if (line.startsWith('ceTaskUrl=')) {
              ceTaskUrl = line.split('=')[1].trim()
            }
          }

          if (!ceTaskUrl) {
            error "ceTaskUrl not found inside report-task.txt; cannot poll Sonar CE"
          }

          echo "Found ceTaskUrl: ${ceTaskUrl}"

          // Poll CE task until complete and get analysisId
          def analysisId = null
          def ceStatus = null
          int maxTries = 30
          int delaySeconds = 6

          for (int i = 0; i < maxTries; i++) {
            sleep(time: delaySeconds, unit: 'SECONDS')
            echo "Polling CE task status (attempt ${i+1}/${maxTries})..."
            def ceResp = httpRequest(
              url: ceTaskUrl,
              customHeaders: [[name: 'Authorization', value: "Bearer ${SONAR_TOKEN}"]],
              validResponseCodes: '200'
            )
            def ceJson = new groovy.json.JsonSlurperClassic().parseText(ceResp.content)
            ceStatus = ceJson.task?.status
            echo "CE status: ${ceStatus}"
            if (ceJson.task?.analysisId) {
              analysisId = ceJson.task.analysisId
              echo "Found analysisId: ${analysisId}"
            }
            if (ceStatus == 'SUCCESS') {
              break
            } else if (ceStatus == 'FAILED' || ceStatus == 'CANCELED') {
              error "Sonar CE task ended with status: ${ceStatus}"
            }
          }

          if (!analysisId) {
            error "analysisId not found after polling CE task; cannot determine quality gate"
          }

          // Call quality gate API by analysisId
          // Derive base URL from ceTaskUrl to build project_status endpoint
          def base = ceTaskUrl.replaceAll(/api\\/ce\\/task.*/, '')
          def qgUrl = "${base}api/qualitygates/project_status?analysisId=${URLEncoder.encode(analysisId, 'UTF-8')}"
          echo "Querying quality gate at: ${qgUrl}"

          def qgResp = httpRequest(
            url: qgUrl,
            customHeaders: [[name: 'Authorization', value: "Bearer ${SONAR_TOKEN}"]],
            validResponseCodes: '200'
          )
          def qgJson = new groovy.json.JsonSlurperClassic().parseText(qgResp.content)
          def qgStatus = qgJson.projectStatus?.status
          echo "Quality Gate status: ${qgStatus}"

          if (qgStatus == 'OK') {
            echo "Quality gate PASSED ✅"
          } else {
            error "Quality gate FAILED: ${qgStatus}"
          }
        }
      }
    }

    stage('Docker Build (Windows CLI)') {
      steps {
        script {
          def tag = "${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
          // Build with Docker CLI on Windows host
          bat "docker build -t ${tag} ."
          // store for later stages
          env.IMAGE_TAG = tag
          echo "Docker image built: ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Docker Push (login with Jenkins creds)') {
      steps {
        script {
          // Use Jenkins username/password credentials to login to DockerHub
          withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS_ID, usernameVariable: 'DH_USER', passwordVariable: 'DH_PSW')]) {
            // login, tag is already the repo:tag format
            bat 'docker login -u %DH_USER% -p %DH_PSW%'
            bat "docker push ${env.IMAGE_TAG}"
            // optional: docker logout
            bat 'docker logout'
          }
          echo "Docker image pushed: ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Deploy (docker run on Jenkins host)') {
      steps {
        script {
          // run detached, expose 3000 locally (adjust port if your app uses a different port)
          try {
            bat "docker run -d --rm -p 3000:3000 --name ci_node_${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
            echo "Deployment attempted for ${env.IMAGE_TAG}"
          } catch (err) {
            echo "Deploy step failed/skipped: ${err}"
          }
        }
      }
    }
  }

  post {
    success {
      echo "Pipeline completed successfully!"
    }
    failure {
      echo "Pipeline failed!"
    }
    always {
      echo "Build ${env.BUILD_NUMBER} finished with status ${currentBuild.currentResult}"
    }
  }
}

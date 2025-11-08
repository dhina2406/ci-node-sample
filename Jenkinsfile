pipeline {
  agent any

  environment {
    SONAR_TOKEN = credentials('sonar-token')        // SonarCloud token (secret text)
    DOCKERHUB_CREDENTIALS = 'dockerhub-creds'       // DockerHub credentials id
    DOCKERHUB_REPO = 'dhina2406/ci-node-sample'     // change if needed
  }

  options {
    buildDiscarder(logRotator(daysToKeepStr: '7', numToKeepStr: '10'))
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm install'
            sh 'npm test'
          } else {
            bat 'npm install'
            bat 'npm test'
          }
        }
      }
    }

    stage('SonarCloud Analysis') {
      steps {
        script {
          // ensure SonarScanner tool exists in Jenkins Tools (name: SonarScanner)
          def scannerHome = tool 'SonarScanner'
          withSonarQubeEnv('SonarCloud') {
            if (isUnix()) {
              sh """
                ${scannerHome}/bin/sonar-scanner \
                -Dsonar.projectKey=dhina2406_ci-node-sample \
                -Dsonar.organization=dhina2406 \
                -Dsonar.sources=. \
                -Dsonar.login=${SONAR_TOKEN} \
                -Dsonar.scanner.metadataFile=report-task.txt
              """
            } else {
              bat """
                "${scannerHome}\\bin\\sonar-scanner.bat" ^
  -Dsonar.projectKey=dhina2406_ci-node-sample ^
  -Dsonar.organization=dhina2406 ^
  -Dsonar.sources=. ^
  -Dsonar.login=%SONAR_TOKEN% ^
  -Dsonar.scanner.metadataFile=%WORKSPACE%\\report-task.txt
              """
            }
          }

          // print report-task.txt content for debugging
          script {
            if (isUnix()) {
              sh 'echo "---- report-task.txt ----" || true; cat report-task.txt || true; echo "------------------------"'
            } else {
              bat 'echo ---- report-task.txt ---- & type report-task.txt || echo not-found & echo ------------------------'
            }
          }
        }
      }
    }

    stage('Quality Gate (poll SonarCloud)') {
      steps {
        script {
          // Read report-task.txt and extract ceTaskUrl or taskId
          def txt
          try {
            txt = readFile('report-task.txt')
          } catch (err) {
            error "report-task.txt not found in workspace: ${err}"
          }

          def ceTaskUrl = null
          txt.readLines().each { line ->
            if (line.startsWith('ceTaskUrl=')) {
              ceTaskUrl = line.split('=')[1].trim()
            }
          }

          if (!ceTaskUrl) {
            error "ceTaskUrl not found inside report-task.txt; cannot poll SonarCloud"
          }

          echo "Found ceTaskUrl: ${ceTaskUrl}"

          // Derive quality gate API endpoint from CE URL:
          // Some installations: ceTaskUrl -> https://sonarcloud.io/api/ce/task?id=... 
          // We will call project_status endpoint: https://sonarcloud.io/api/qualitygates/project_status?projectKey=...
          // But report-task.txt might not contain projectKey — we will poll CE to get analysisId then query project_status by analysisId.
          // Strategy: poll CE until status = SUCCESS, use analysisId -> call api/qualitygates/project_status?analysisId=<analysisId>
          def analysisId = null
          def ceStatus = null

          // Poll CE task until it completes (max tries)
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
            // otherwise continue waiting
          }

          if (!analysisId) {
            error "analysisId not found after polling CE task; cannot determine quality gate"
          }

          // Now call project_status with analysisId
          def qgUrl = "${ceTaskUrl.replaceAll(/api\\/ce\\/task.*\$/, 'api/qualitygates/project_status')}?analysisId=${URLEncoder.encode(analysisId, 'UTF-8')}"
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

    stage('Docker Build') {
      steps {
        script {
          try {
            def imageTag = "${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
            if (isUnix()) {
              def img = docker.build(imageTag)
              env.IMAGE_TAG = imageTag
            } else {
              // Windows - use Docker CLI
              bat "docker build -t ${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER} ."
              env.IMAGE_TAG = "${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
            }
            echo "Docker image built: ${env.IMAGE_TAG}"
          } catch (err) {
            error "Docker build failed or Docker not available on this agent: ${err}"
          }
        }
      }
    }

    stage('Docker Push') {
      steps {
        script {
          try {
            // Use docker.withRegistry if docker plugin available and Docker CLI is logged in
            docker.withRegistry('https://index.docker.io/v1/', DOCKERHUB_CREDENTIALS) {
              def img = docker.image("${env.IMAGE_TAG}")
              img.push()
            }
            echo "Docker image pushed: ${env.IMAGE_TAG}"
          } catch (err) {
            // Fallback to CLI push (requires docker login to be setup on agent)
            echo "docker.withRegistry failed or plugin not available, attempting CLI push..."
            if (isUnix()) {
              sh "docker push ${env.IMAGE_TAG}"
            } else {
              bat "docker push ${env.IMAGE_TAG}"
            }
            echo "Docker CLI push attempted for: ${env.IMAGE_TAG}"
          }
        }
      }
    }

    stage('Deploy (local)') {
      steps {
        script {
          try {
            if (isUnix()) {
              sh "docker run -d --rm -p 3000:3000 --name ci_node_${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
            } else {
              bat "docker run -d --rm -p 3000:3000 --name ci_node_${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
            }
            echo "Deployment (docker run) attempted for ${env.IMAGE_TAG}"
          } catch (err) {
            echo "Deploy step skipped/failed (Docker may not be available): ${err}"
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

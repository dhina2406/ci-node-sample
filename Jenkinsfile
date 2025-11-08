pipeline {
  agent any

  environment {
    SONAR_TOKEN = credentials('sonar-token')
    DOCKERHUB_CREDENTIALS = 'dockerhub-creds'
    DOCKERHUB_REPO = 'dhina2406/ci-node-sample'
  }

  options {
    buildDiscarder(logRotator(daysToKeepStr: '7', numToKeepStr: '10'))
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
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
          def scannerHome = tool 'SonarScanner'
          withSonarQubeEnv('SonarCloud') {
            if (isUnix()) {
              sh """
                ${scannerHome}/bin/sonar-scanner \
                -Dsonar.projectKey=dhina2406_ci-node-sample \
                -Dsonar.organization=dhina2406 \
                -Dsonar.sources=. \
                -Dsonar.login=${SONAR_TOKEN}
              """
            } else {
              // use Windows form with %SONAR_TOKEN% expanded by Jenkins credentials wrapper
              bat """
                "${scannerHome}\\bin\\sonar-scanner.bat" ^
                -Dsonar.projectKey=dhina2406_ci-node-sample ^
                -Dsonar.organization=dhina2406 ^
                -Dsonar.sources=. ^
                -Dsonar.login=%SONAR_TOKEN%
              """
            }
          }
        }
      }
    }

    stage('Quality Gate') {
  steps {
    script {
      echo "Checking SonarCloud Quality Gate status via API..."
      def taskIdFile = readFile('report-task.txt').trim()
      def ceTaskUrl = taskIdFile.readLines().find { it.startsWith('ceTaskUrl=') }?.split('=')[1]
      if (!ceTaskUrl) {
        error "Could not find ceTaskUrl in report-task.txt"
      }

      // Poll SonarCloud API for quality gate result
      def gatePassed = false
      for (int i = 0; i < 15; i++) {
        sleep(time: 20, unit: 'SECONDS')
        def response = httpRequest(
          url: ceTaskUrl.replace("api/ce/task", "api/qualitygates/project_status"),
          customHeaders: [[name: 'Authorization', value: "Bearer ${SONAR_TOKEN}"]],
          validResponseCodes: '200'
        )
        if (response.content.contains('"status":"OK"')) {
          echo "Quality gate PASSED ✅"
          gatePassed = true
          break
        } else if (response.content.contains('"status":"ERROR"')) {
          error "Quality gate FAILED ❌"
        } else {
          echo "Waiting for quality gate result..."
        }
      }

      if (!gatePassed) {
        error "Quality gate check timed out after waiting"
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
              docker.build(imageTag)
              env.IMAGE_TAG = imageTag
            } else {
              bat "docker build -t ${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER} ."
              env.IMAGE_TAG = "${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
            }
          } catch (err) {
            error "Docker build failed or Docker not available: ${err}"
          }
        }
      }
    }

    stage('Docker Push') {
      steps {
        script {
          try {
            docker.withRegistry('https://index.docker.io/v1/', DOCKERHUB_CREDENTIALS) {
              docker.image("${env.IMAGE_TAG}").push()
            }
          } catch (err) {
            if (isUnix()) {
              sh "docker push ${env.IMAGE_TAG}"
            } else {
              bat "docker push ${env.IMAGE_TAG}"
            }
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
          } catch (err) {
            echo "Deploy skipped/failed (Docker not available): ${err}"
          }
        }
      }
    }
  }

  post {
    success { echo "Pipeline completed successfully!" }
    failure { echo "Pipeline failed!" }
    always { echo "Build ${env.BUILD_NUMBER} finished with status ${currentBuild.currentResult}" }
  }
}
